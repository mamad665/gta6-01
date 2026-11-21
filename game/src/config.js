// Solmar City — open-world crime game. All original: city, names, story, art.
// config.js — world constants, palette, tuning.

export const WORLD = {
  width: 3600,
  height: 2800,
  roadGap: 300, // distance between road center lines
  roadWidth: 72,
  beachY: 2560, // sand starts here
  waterY: 2720, // sea starts here
};

export const PALETTE = {
  grass: '#5da24a',
  grassDark: '#4c8a3d',
  park: '#3f7d33',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a8',
  sand: '#e6cf8f',
  water: '#2f7fc4',
  waterDeep: '#2563a0',
  buildingRoof: ['#c96f4a', '#7d8aa5', '#b5a06a', '#8a6f9e', '#5f8a7a', '#a55454'],
  buildingWall: ['#e8dcc8', '#d9c9a8', '#cfd6dd', '#e3cfae'],
};

export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 260,
  radius: 13,
  health: 100,
};

export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 460,
  maxReverse: 150,
  turnRate: 2.6,
  drag: 0.55,
};

export const TRAFFIC = {
  count: 16,
  speedMin: 85,
  speedMax: 135,
};

export const PEDS = {
  count: 26,
  speedMin: 28,
  speedMax: 55,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 25, // seconds without crime before stars start falling
  decayStep: 8, // seconds per star lost while hidden
};

export const COLORS = {
  carPaint: ['#d63a2f', '#2f6fd6', '#e8b62a', '#3fae5a', '#7a4fd0', '#e8e8e8', '#222831', '#e07b39', '#19b8c4'],
  policePaint: '#1d4ed8',
  taxiPaint: '#f2c200',
  pedShirt: ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c'],
  pedSkin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'],
};

export const SAVE_KEY = 'solmar-city-save-v1';

export const STORY = {
  title: 'SOLMAR CITY',
  subtitle: 'An open-world crime story — all original, nothing borrowed.',
  intro:
    'Solmar City. Sun, sea, and everyone looking for an angle. ' +
    'You are Marco Vale, a wheelman with a debt and a fast right foot. ' +
    'Rosa Delgado runs the garage on 5th & Marlin — and she has work for you. ' +
    'Take the jobs. Dodge the Solmar PD. Get paid.',
};
