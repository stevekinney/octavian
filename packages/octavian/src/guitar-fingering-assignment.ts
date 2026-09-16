import type { GuitarBarre } from './guitar-fingerings.js';

export type GuitarFingerAssignmentOptions = {
  readonly availableFingers: number;
  readonly allowBarres: boolean;
};

export type GuitarFingerAssignment = {
  readonly fingers: readonly (number | null)[];
  readonly barres: readonly GuitarBarre[];
};

type FingerCandidate = GuitarFingerAssignment & {
  readonly usedFingers: number;
};

type BarreResult = GuitarBarre | null | 'invalid';
type NonEmptyNumbers = readonly [number, ...number[]];

function stoppedIndexes(frets: readonly (number | null)[]): readonly number[] {
  return Object.freeze(frets.flatMap((fret, index) => (fret !== null && fret > 0 ? [index] : [])));
}

function nonEmptyNumbers(values: readonly number[]): NonEmptyNumbers | null {
  const first = values[0];
  return first === undefined ? null : [first, ...values.slice(1)];
}

function assignmentKey(fingers: readonly (number | null)[]): string {
  return fingers.map((finger) => (finger === null ? '~' : String(finger))).join(',');
}

function barreEndpointIndexes(indexes: NonEmptyNumbers): readonly [number, number] {
  return [indexes[0], indexes[indexes.length - 1]!];
}

function sameFretGroup(frets: readonly (number | null)[], indexes: NonEmptyNumbers): number | null {
  const fret = frets[indexes[0]];
  if (fret === undefined || fret === null || !indexes.every((index) => frets[index] === fret))
    return null;
  return fret;
}

function crossingAllowsBarre(
  frets: readonly (number | null)[],
  labels: readonly number[],
  endpoints: readonly [number, number],
  finger: number,
  fret: number,
): boolean {
  for (let index = endpoints[0]; index <= endpoints[1]; index += 1) {
    const current = frets[index];
    if (current === undefined || current === null || current === 0 || current < fret) return false;
    if (current === fret && labels[index] !== finger) return false;
  }

  return true;
}

function barreForFinger(
  frets: readonly (number | null)[],
  labels: readonly number[],
  finger: number,
  settings: GuitarFingerAssignmentOptions,
): BarreResult {
  const indexes = nonEmptyNumbers(
    stoppedIndexes(frets).filter((index) => labels[index] === finger),
  );
  if (!indexes) return null;

  const fret = sameFretGroup(frets, indexes);
  if (fret === null) return 'invalid';
  if (indexes.length === 1) return null;
  if (!settings.allowBarres || finger === 4) return 'invalid';

  const endpoints = barreEndpointIndexes(indexes);
  if (!crossingAllowsBarre(frets, labels, endpoints, finger, fret)) return 'invalid';

  return Object.freeze({ finger, fret, fromString: endpoints[0], toString: endpoints[1] });
}

function barresForLabels(
  frets: readonly (number | null)[],
  labels: readonly number[],
  settings: GuitarFingerAssignmentOptions,
): readonly GuitarBarre[] | null {
  const barres: GuitarBarre[] = [];

  for (let finger = 1; finger <= settings.availableFingers; finger += 1) {
    const barre = barreForFinger(frets, labels, finger, settings);
    if (barre === 'invalid') return null;
    if (barre) barres.push(barre);
  }

  return Object.freeze(barres);
}

function fretsForFinger(
  stopped: readonly number[],
  frets: readonly (number | null)[],
  labels: readonly number[],
  finger: number,
): readonly number[] {
  return Object.freeze(
    stopped.filter((index) => labels[index] === finger).map((index) => frets[index]!),
  );
}

function fingerFretsAreNondecreasing(
  stopped: readonly number[],
  frets: readonly (number | null)[],
  labels: readonly number[],
  fingers: number,
): boolean {
  let previousMaximum: number | null = null;

  for (let finger = 1; finger <= fingers; finger += 1) {
    const current = fretsForFinger(stopped, frets, labels, finger);
    if (current.length === 0) continue;

    const currentMinimum = Math.min(...current);
    if (previousMaximum !== null && previousMaximum > currentMinimum) return false;
    previousMaximum = Math.max(...current);
  }

  return true;
}

function fingersForLabels(
  frets: readonly (number | null)[],
  labels: readonly number[],
): readonly (number | null)[] {
  return Object.freeze(
    frets.map((fret, index) => (fret === null || fret === 0 ? null : (labels[index] ?? null))),
  );
}

function candidateForLabels(
  frets: readonly (number | null)[],
  labels: readonly number[],
  settings: GuitarFingerAssignmentOptions,
): FingerCandidate | null {
  const stopped = stoppedIndexes(frets);
  if (!fingerFretsAreNondecreasing(stopped, frets, labels, settings.availableFingers)) return null;

  const barres = barresForLabels(frets, labels, settings);
  if (!barres) return null;

  return Object.freeze({
    fingers: fingersForLabels(frets, labels),
    barres,
    usedFingers: new Set(labels.filter(Boolean)).size,
  });
}

function compareFingerCandidates(left: FingerCandidate, right: FingerCandidate): number {
  return (
    left.usedFingers - right.usedFingers ||
    left.barres.length - right.barres.length ||
    assignmentKey(left.fingers).localeCompare(assignmentKey(right.fingers))
  );
}

function betterCandidate(
  current: FingerCandidate | null,
  next: FingerCandidate | null,
): FingerCandidate | null {
  if (!next) return current;
  if (!current) return next;
  return compareFingerCandidates(next, current) < 0 ? next : current;
}

export function assignGuitarFingers(
  frets: readonly (number | null)[],
  settings: GuitarFingerAssignmentOptions,
): GuitarFingerAssignment | null {
  const stopped = stoppedIndexes(frets);
  const labels = Array<number>(frets.length).fill(0);
  const best: { value: FingerCandidate | null } = { value: null };

  function visit(position: number): void {
    if (position === stopped.length) {
      best.value = betterCandidate(best.value, candidateForLabels(frets, labels, settings));
      return;
    }

    const stringIndex = stopped[position]!;

    for (let finger = 1; finger <= settings.availableFingers; finger += 1) {
      labels[stringIndex] = finger;
      visit(position + 1);
    }
    labels[stringIndex] = 0;
  }

  visit(0);
  return best.value ? { fingers: best.value.fingers, barres: best.value.barres } : null;
}
