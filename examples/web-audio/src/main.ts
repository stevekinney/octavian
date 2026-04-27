import { createOctave, Note } from 'octavian';

const octave4 = createOctave(4);
const a4 = new Note('A', octave4);
const c4 = new Note('C', octave4);

if (a4.frequency !== 440 || c4.midi !== 60) {
  document.body.dataset['octavianStatus'] = `fail: A4.freq=${a4.frequency} C4.midi=${c4.midi}`;
} else {
  document.body.dataset['octavianStatus'] = 'ok';
}

document.getElementById('play')?.addEventListener('click', () => {
  const ctx = new AudioContext();
  const osc = new OscillatorNode(ctx, { frequency: a4.frequency });
  osc.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
});
