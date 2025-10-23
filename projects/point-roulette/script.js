const SPIN_DURATION_MS = 1000;

const wheel = document.querySelector('.roulette__wheel');
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
  currentRotation: 0,
};

function updateStatus(text) {
  status.textContent = text;
}

function performSpin(randomValue) {
  const segment = segmentForValue(randomValue);
  const targetRotation = state.currentRotation + 360 + segment.centerAngle;
  const startTimestamp = performance.now();

  wheel.style.transition = 'none';
  wheel.style.transform = `rotate(${state.currentRotation}deg)`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      wheel.style.transition = `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      wheel.style.transform = `rotate(${targetRotation}deg)`;
    });
  });

  return new Promise((resolve) => {
    window.setTimeout(() => {
      state.currentRotation = targetRotation % 360;
      state.isSpinning = false;
      button.disabled = false;
      updateStatus(segment.message);
      resolve({
        segment,
        duration: performance.now() - startTimestamp,
      });
    }, SPIN_DURATION_MS);
  });
}

async function spin({ randomValue } = {}) {
  if (state.isSpinning) {
    return null;
  }

  state.isSpinning = true;
  button.disabled = true;
  updateStatus('Spinning…');

  const value = typeof randomValue === 'number' ? randomValue : Math.random();
  return performSpin(value);
}

button.addEventListener('click', () => {
  spin();
});

window.pointroulette = {
  spin,
  segmentForValue,
  segments,
  messages: segments.map((segment) => segment.message),
  spinDurationMs: SPIN_DURATION_MS,
};
