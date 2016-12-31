const emoji = require('node-emoji')

module.exports = {
  buildGems,
  getEmoji,
  buildDrop,
}

const gems = [
  'Rock',
  'Earth',
  'Water',
  'Ice',
  'Wind',
  'Shock',
  'Fire',
  'Metal',
]

const emojis = {
  'Rock': ':moyai:',
  'Earth': ':chestnut:',
  'Water': ':droplet:',
  'Ice': ':snowflake:',
  'Wind': ':leaves:',
  'Shock': ':zap:',
  'Fire': ':fire:',
  'Metal': ':gear:',
}

function getEmoji (name) {
  return emoji.emojify(emojis[name])
}

function buildGems () {
  return gems.reduce(
    (acc, gem) => Object.assign({}, acc, { [gem]: 0 }),
    {}
  )
}

function buildDrop (monsterLoot) {
  if (!monsterLoot) { return false }
  return monsterLoot.types.reduce((drop, type) => {
    if (Math.random() * 100 < 50) {
      drop[type] = Math.floor(Math.random() * monsterLoot.max) + 1
    }
    return drop
  }, {})
}
