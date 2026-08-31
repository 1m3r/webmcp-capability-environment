/* Games register themselves here. The shell renders whatever is registered and
   knows nothing about rounds, questions or dungeons — which is the whole of the
   platform claim, and it is worth keeping honest even with one game in it. */

const GAMES = new Map();

export function register(game) {
  for (const key of ['id', 'title', 'storageKey', 'createDoc', 'reduce', 'buildTools', 'render']) {
    if (!(key in game)) throw new Error(`a game must supply ${key}`);
  }
  GAMES.set(game.id, game);
  return game;
}

export function get(id) {
  return GAMES.get(id) || null;
}

export function list() {
  return [...GAMES.values()].map((g) => ({ id: g.id, title: g.title }));
}
