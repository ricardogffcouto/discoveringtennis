const SPIN_DURATION_MS = 1000;
const SHAKE_DELAY_MS = 500;
const LATE_MESSAGE = 'Late ball! Unforced error.';

const wheel = document.querySelector('.roulette__wheel');
const wheelContainer = document.querySelector('.roulette__wheel-container');
const button = document.getElementById('spin-button');
const status = document.getElementById('roulette-status');

const SEGMENT_DEFINITIONS = [
  {
    label: 'weak-ball-A',
    size: 0.2,
    message: 'Weak ball – regroup and plan the next shot.',
  },
  {
    label: 'high-percentage',
    size: 0.3,
    message: 'High percentage play – keep the pressure.',
  },
  {
    label: 'unforced-error',
    size: 0.1,
    message: 'Unforced error – recalibrate your footwork.',
  },
  {
    label: 'winner',
    size: 0.05,
    message: 'WINNER! Paints the line.',
  },
  {
    label: 'double-fault',
    size: 0.1,
    message: 'Double fault – rebuild your rhythm.',
  },
  {
    label: 'weak-ball-B',
    size: 0.25,
    message: 'Weak ball floats long – reset the point.',
  },
];

function createSegments(definitions) {
  let cursor = 0;
  return definitions.map((definition) => {
    const start = cursor;
    const end = cursor + definition.size;
    const startAngle = start * 360;
    const endAngle = end * 360;
    cursor = end;
    return {
      ...definition,
      start,
      end,
      startAngle,
      endAngle,
      centerAngle: startAngle + (endAngle - startAngle) / 2,
    };
  });
}

const segments = createSegments(SEGMENT_DEFINITIONS);

function segmentForValue(value) {
  const safeValue = Math.min(Math.max(value, 0), 0.999999);
  return segments.find((segment) => safeValue < segment.end) ?? segments[segments.length - 1];
}

const state = {
  isSpinning: false,
  startTimestamp: 0,
  animationFrameId: null,
  shakeTimeoutId: null,
  autoStopTimeoutId: null,
  lastResult: null,
};

function updateStatus(text) {
  status.textContent = text;
}

function setButtonLabel(text) {
  button.textContent = text;
}

function applyRotation(degrees) {
  wheel.style.transform = `rotate(${degrees}deg)`;
}

function rotationFromElapsed(elapsedMs) {
  const boundedElapsed = Math.max(0, elapsedMs % SPIN_DURATION_MS);
  return (boundedElapsed / SPIN_DURATION_MS) * 360;
}

function clearTimers() {
  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  if (state.shakeTimeoutId !== null) {
    clearTimeout(state.shakeTimeoutId);
    state.shakeTimeoutId = null;
  }
  if (state.autoStopTimeoutId !== null) {
    clearTimeout(state.autoStopTimeoutId);
    state.autoStopTimeoutId = null;
  }
  wheelContainer.classList.remove('roulette__wheel-container--shake');
}

function finishSpin({ timedOut = false, timestamp = performance.now() } = {}) {
  if (!state.isSpinning) {
    return null;
  }

  clearTimers();

  const elapsed = Math.min(timestamp - state.startTimestamp, SPIN_DURATION_MS);
  const rotation = rotationFromElapsed(elapsed);
  applyRotation(rotation);

  state.isSpinning = false;
  setButtonLabel('Tap to Start');

  if (timedOut) {
    updateStatus(LATE_MESSAGE);
    state.lastResult = {
      timedOut: true,
      elapsed,
      message: LATE_MESSAGE,
      segment: null,
    };
    return state.lastResult;
  }

  const normalizedValue = (elapsed % SPIN_DURATION_MS) / SPIN_DURATION_MS;
  const segment = segmentForValue(normalizedValue);
  updateStatus(segment.message);

  state.lastResult = {
    timedOut: false,
    elapsed,
    segment,
    message: segment.message,
  };
  return state.lastResult;
}

function tick(now) {
  const elapsed = now - state.startTimestamp;
  applyRotation(rotationFromElapsed(elapsed));
  state.animationFrameId = requestAnimationFrame(tick);
}

function beginSpin() {
  if (state.isSpinning) {
    return null;
  }

  clearTimers();
  applyRotation(0);
  state.isSpinning = true;
  state.startTimestamp = performance.now();
  state.lastResult = null;
  setButtonLabel('Tap to Stop');
  updateStatus('Control the rally – tap again to set the outcome.');

  state.animationFrameId = requestAnimationFrame(tick);
  state.shakeTimeoutId = window.setTimeout(() => {
    wheelContainer.classList.add('roulette__wheel-container--shake');
  }, SHAKE_DELAY_MS);

  state.autoStopTimeoutId = window.setTimeout(() => {
    finishSpin({ timedOut: true });
  }, SPIN_DURATION_MS);

  return {
    startedAt: state.startTimestamp,
    spinDurationMs: SPIN_DURATION_MS,
  };
}

button.addEventListener('click', () => {
  if (!state.isSpinning) {
    beginSpin();
  } else {
    finishSpin({ timedOut: false });
  }
});

window.pointroulette = {
  start: beginSpin,
  stop: () => finishSpin({ timedOut: false }),
  timeout: () => finishSpin({ timedOut: true }),
  isSpinning: () => state.isSpinning,
  lastResult: () => state.lastResult,
  segmentForValue,
  segments,
  messages: segments.map((segment) => segment.message),
  spinDurationMs: SPIN_DURATION_MS,
  lateMessage: LATE_MESSAGE,
};
