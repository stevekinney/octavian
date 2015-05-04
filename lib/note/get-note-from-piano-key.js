import { pianoKeys } from './piano-keys';

const noteIndex = swapKeysAndValues(pianoKeys);

export default function (pianoKey) {
  return noteIndex[pianoKey];
}

function swapKeysAndValues(object) {
  return Object.keys(object).reduce((newObject, key) => {
    const value = object[key];
    newObject[value] = key;
    return newObject;
  }, {});
}