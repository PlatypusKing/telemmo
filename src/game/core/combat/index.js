import {
  add,
  always,
  prop,
  assoc,
  mergeWith,
  ifElse,
  partial,
  isArrayLike,
  pipe,
  set,
  map,
  merge,
  lensProp,
} from 'ramda'

import cuid from 'cuid'
import Promise from 'bluebird'

import { buildCombatStats } from '../combatStats'
import { rollBatch } from '../dice'

import dropPrizes from './dropPrizes'
import turn from './turn'
import addTeamsLevels from './addTeamsLevels'
import { combatMemberIds } from './utils'

function runInitiative (teams, rolls) {
  const names = teams.map(team => team.overall.name)

  if (rolls[names[0]] === rolls[names[1]]) {
    return initiative(teams)
  }

  if (rolls[names[0]] > rolls[names[1]]) {
    return {
      order: [teams[0], teams[1]],
      rolls
    }
  }

  return {
    order: [teams[1], teams[0]],
    rolls
  }
}

function initiative (teams) {
  return rollBatch(20, [teams[0].overall.name, teams[1].overall.name])
    .then(partial(runInitiative, [teams]))
}


function markFinished (combat) {
  return pipe(
    set(lensProp('finishedAt'), new Date()),
    set(lensProp('winners'), combat.teams[0].members.map(prop('id'))),
  )(combat)
}

function finish (combat) {
  return dropPrizes(combat)
    .then(markFinished)
}

function wait (combat) {
  const amount = process.env.NODE_ENV === 'production'
    ? 40000 + (Math.random() * 30000)
    : 3141 + (Math.random() * 2000)

  return Promise.delay(amount)
    .then(always(combat))
}

function updateCombat (dao, combat) {
  const query = {
    token: combat.token,
  }

  return dao.combat.update(query, combat)
}

function upsertCombat (dao, combat) {
  let query = {
    'teams.members': {
      $elemMatch: {
        id: { $in: combatMemberIds(combat) },
      },
    },
  }

  if (combat.id) {
    query = merge(query, { _id: combat.id })
  }

  if (!combat.finishedAt) {
    query = merge(query, {
      finishedAt: { $exists: false },
    })
  }

  return dao.combat.update(query, combat, { upsert: true })
}

function mergeFighter (a, b) {
  return ifElse(
    isArrayLike,
    always(undefined),
    add(b),
  )(a)
}

function buildTeam (members) {
  return {
    overall: members.reduce((acc, fighter) =>
      mergeWith(mergeFighter, acc, fighter),
      { stance: [] }),
    members,
  }
}

function build (dao, source, tms) {
  return Promise.resolve(tms)
    .then(partial(addTeamsLevels, [dao]))
    .then(teams =>
      Promise.all(teams.map(team =>
        Promise.all(team.map(buildCombatStats)))),
    )
    .then(map(buildTeam))
    .then(initiative)
    .then(initTurn => ({
      teams: initTurn.order,
      initialTeams: initTurn.order,
      startedAt: new Date(),
      turns: [
        {
          winner: initTurn.order[0].overall.name,
          rolls: initTurn.rolls,
        },
      ],
    }))
    .then(assoc('token', cuid()))
    .then(assoc('source', source))
    .then(partial(upsertCombat, [dao]))
    .then(wait)
}

export function start (combat) {
  function* generate () {
    let state = combat
    while (!state.finishedAt) {
      state = yield turn(state, finish)
    }

    return state
  }

  return Promise.resolve()
    .then(Promise.coroutine(generate))
}

export function run (dao, source, teams) {
  return build(dao, source, teams)
    .then(start)
    .then(partial(updateCombat, [dao]))
}

