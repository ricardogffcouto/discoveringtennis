const config = {
  spinDurationMs: 1000,
  shakeDelayMs: 500,
  buttonLabels: {
    start: 'Start',
    hit: 'Hit',
    reset: 'Reset',
  },
  statusMessages: {
    idle: 'Waiting for your serve.',
    running: 'Control the rally – tap again to set the outcome.',
    late: 'Late ball! Unforced error.',
  },
  ballScale: {
    min: 0.15,
    max: 1.05,
  },
  ballRotation: {
    min: 0,
    max: 360,
  },
  wheel: {
    baseRotation: 90,
  },
};

const elements = {
  wheel: document.querySelector('.roulette__wheel'),
  wheelContainer: document.querySelector('.roulette__wheel-container'),
  ball: document.querySelector('.roulette__ball'),
  button: document.getElementById('spin-button'),
  status: document.getElementById('roulette-status'),
};

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
    cursor = end;

    return {
      ...definition,
      start,
      end,
    };
  });
}

const segments = createSegments(SEGMENT_DEFINITIONS);

function segmentForValue(value) {
  const safeValue = Math.min(Math.max(value, 0), 0.999999);
  return segments.find((segment) => safeValue < segment.end) ?? segments[segments.length - 1];
}

const timers = {
  frame: null,
  shake: null,
  timeout: null,
};

const state = {
  phase: 'idle',
  startedAt: 0,
  lastResult: null,
};

function setStatus(message) {
  elements.status.textContent = message;
}

function setButtonLabel(label) {
  elements.button.textContent = label;
}

function setWheelRotation(degrees) {
  elements.wheel.style.setProperty('--wheel-rotation', `${degrees}deg`);
}

function setBallState(elapsedMs) {
  const clamped = Math.min(Math.max(elapsedMs, 0), config.spinDurationMs);
  const progress = clamped / config.spinDurationMs;
  const scaleRange = config.ballScale.max - config.ballScale.min;
  const scale = config.ballScale.min + progress * scaleRange;
  const rotationRange = config.ballRotation.max - config.ballRotation.min;
  const rotation = config.ballRotation.min + progress * rotationRange;
  elements.wheel.style.setProperty('--ball-scale', scale.toFixed(3));
  elements.wheel.style.setProperty('--ball-rotation', `${rotation.toFixed(1)}deg`);
}

function toggleShake(isActive) {
  elements.wheelContainer.classList.toggle('roulette__wheel-container--shake', isActive);
}

function clearFrameLoop() {
  if (timers.frame !== null) {
    cancelAnimationFrame(timers.frame);
    timers.frame = null;
  }
}

function clearShakeTimer() {
  if (timers.shake !== null) {
    clearTimeout(timers.shake);
    timers.shake = null;
  }
}

function clearAutoTimeout() {
  if (timers.timeout !== null) {
    clearTimeout(timers.timeout);
    timers.timeout = null;
  }
}

function clearTimers() {
  clearFrameLoop();
  clearShakeTimer();
  clearAutoTimeout();
  toggleShake(false);
}

function clampElapsed(elapsedMs) {
  return Math.min(Math.max(elapsedMs, 0), config.spinDurationMs);
}

function rotationFromElapsed(elapsedMs) {
  const clamped = clampElapsed(elapsedMs);
  return (clamped / config.spinDurationMs) * 360;
}

function valueFromElapsed(elapsedMs) {
  const clamped = Math.min(Math.max(elapsedMs, 0), config.spinDurationMs - 1);
  return clamped / config.spinDurationMs;
}

function segmentFromElapsed(elapsedMs) {
  return segmentForValue(valueFromElapsed(elapsedMs));
}

function applyWheelState(elapsedMs) {
  setWheelRotation(rotationFromElapsed(elapsedMs));
  setBallState(elapsedMs);
}

function finishSpin({
  reason = 'manual',
  timestamp = performance.now(),
} = {}) {
  if (state.phase !== 'spinning') {
    return state.lastResult;
  }

  clearTimers();

  const elapsed = Math.min(timestamp - state.startedAt, config.spinDurationMs);
  const displayElapsed = reason === 'timeout' ? config.spinDurationMs - 1 : elapsed;
  applyWheelState(displayElapsed);

  state.phase = 'result';
  setButtonLabel(config.buttonLabels.reset);

  if (reason === 'timeout') {
    const result = {
      timedOut: true,
      elapsed,
      message: config.statusMessages.late,
      segment: null,
    };
    state.lastResult = result;
    setStatus(result.message);
    return result;
  }

  const segment = segmentFromElapsed(elapsed);
  const result = {
    timedOut: false,
    elapsed,
    segment,
    message: segment.message,
  };
  state.lastResult = result;
  setStatus(result.message);
  return result;
}

function tick(now) {
  const elapsed = now - state.startedAt;
  applyWheelState(elapsed);
  timers.frame = requestAnimationFrame(tick);
}

function beginSpin() {
  if (state.phase === 'spinning') {
    return null;
  }

  if (state.phase === 'result') {
    return state.lastResult;
  }

  clearTimers();
  applyWheelState(0);

  state.phase = 'spinning';
  state.startedAt = performance.now();
  state.lastResult = null;

  setButtonLabel(config.buttonLabels.hit);
  setStatus(config.statusMessages.running);

  timers.frame = requestAnimationFrame(tick);
  timers.shake = window.setTimeout(() => toggleShake(true), config.shakeDelayMs);
  timers.timeout = window.setTimeout(() => finishSpin({ reason: 'timeout' }), config.spinDurationMs);

  return {
    startedAt: state.startedAt,
    spinDurationMs: config.spinDurationMs,
  };
}

elements.button.addEventListener('click', () => {
  if (state.phase === 'spinning') {
    finishSpin({ reason: 'manual' });
    return;
  }

  if (state.phase === 'result') {
    resetRoulette();
    return;
  }

  beginSpin();
});

function resetRoulette() {
  clearTimers();

  const suppressTransitions = () => {
    elements.wheel.classList.add('roulette__wheel--no-transition');
    elements.ball.classList.add('roulette__ball--no-transition');
  };

  const restoreTransitions = () => {
    elements.wheel.classList.remove('roulette__wheel--no-transition');
    elements.ball.classList.remove('roulette__ball--no-transition');
  };

  suppressTransitions();
  elements.wheel.style.setProperty('--wheel-base-rotation', `${config.wheel.baseRotation}deg`);
  applyWheelState(0);
  // Force reflow so the immediate reset takes effect before restoring transitions.
  void elements.wheel.offsetWidth;
  restoreTransitions();

  state.phase = 'idle';
  state.startedAt = 0;
  state.lastResult = null;

  setButtonLabel(config.buttonLabels.start);
  setStatus(config.statusMessages.idle);
}

window.pointroulette = {
  start: beginSpin,
  stop: () => finishSpin({ reason: 'manual' }),
  timeout: () => finishSpin({ reason: 'timeout' }),
  reset: resetRoulette,
  isSpinning: () => state.phase === 'spinning',
  lastResult: () => state.lastResult,
  segmentForValue,
  segments,
  messages: segments.map((segment) => segment.message),
  spinDurationMs: config.spinDurationMs,
  lateMessage: config.statusMessages.late,
};

resetRoulette();
