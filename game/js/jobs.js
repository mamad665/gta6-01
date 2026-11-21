// Rosa Delgado's four chained jobs. Each job is a sequence of waypoints;
// reaching one advances the chain. Finishing job 4 ends the story.

import { spawnParkedCar } from './cars.js';

function center(lm) { return { x: lm.x + lm.w / 2, y: lm.y + lm.h / 2 }; }

export const JOBS = [
  {
    name: 'First Run', pay: 500,
    intro: "Rosa: a package is waiting at the Port Docks. Bring it to Pier 9 — no detours, no cops.",
    steps: [
      { text: 'Pick up the package at the Port Docks', at: 'Port Docks' },
      { text: 'Deliver the package to Pier 9 Hideout', at: 'Pier 9 Hideout' },
    ],
  },
  {
    name: 'Hot Wheels', pay: 800,
    intro: "Rosa: a yellow Comet GT is parked at Sunset Mall. Bring it to my garage. Try not to scratch it.",
    steps: [
      { text: 'Steal the yellow Comet GT at Sunset Mall', at: 'Sunset Mall', car: 'comet' },
      { text: 'Deliver the Comet GT to Rosa\'s Garage', at: "Rosa's Garage", inCar: true },
    ],
  },
  {
    name: 'The Drop', pay: 1200,
    intro: 'Rosa: pick up the case at the Marina and drop it at St. Marina Hospital. Quietly.',
    steps: [
      { text: 'Pick up the case at the Marina', at: 'Marina' },
      { text: 'Drop the case at St. Marina Hospital', at: 'St. Marina Hospital' },
    ],
  },
  {
    name: 'Bank Van Blues', pay: 2500,
    intro: 'Rosa: a bank van is rolling past Solmar Bank. Take it — and bring it to Pier 9.',
    steps: [
      { text: 'Intercept the bank van near Solmar Bank', at: 'Solmar Bank', van: true },
      { text: 'Drive the bank van to Pier 9 Hideout', at: 'Pier 9 Hideout', inCar: true },
    ],
  },
];

export function createJobs(city) {
  return {
    index: 0,
    step: 0,
    done: false,
    target: null,
    van: null,
    comet: null,
    city,
  };
}

function landmarkPoint(city, name) {
  const lm = city.landmarks[name];
  if (!lm) return { x: city.w / 2, y: city.h / 2 };
  return center(lm);
}

export function currentJobText(jobs) {
  if (jobs.done) return 'All jobs done — Solmar is yours. Free roam.';
  const job = JOBS[jobs.index];
  const step = job.steps[jobs.step];
  return `Job ${jobs.index + 1}/4 — ${job.name}: ${step.text} ($${job.pay})`;
}

export function startJob(jobs) {
  const job = JOBS[jobs.index];
  const step = job.steps[jobs.step];
  jobs.target = landmarkPoint(jobs.city, step.at);
  jobs.targetRect = jobs.city.landmarks[step.at] || null;
  if (step.car === 'comet' && !jobs.comet) {
    jobs.comet = spawnParkedCar(jobs.city, jobs.target.x, jobs.target.y, '#ffd23e');
    jobs.comet.kind = 'comet';
  }
  if (step.van && !jobs.van) {
    jobs.van = spawnParkedCar(jobs.city, jobs.target.x, jobs.target.y, '#2c3e50');
    jobs.van.kind = 'van';
    jobs.van.len = 58;
    jobs.van.maxSpeed = 380;
  }
  return job.intro;
}

export function updateJobs(jobs, hero, onAdvance, onComplete) {
  if (jobs.done) return;
  const job = JOBS[jobs.index];
  const step = job.steps[jobs.step];
  const px = hero.inCar ? hero.inCar.x : hero.x;
  const py = hero.inCar ? hero.inCar.y : hero.y;
  let d;
  if (jobs.targetRect) {
    const r = jobs.targetRect;
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
    const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
    d = Math.hypot(dx, dy);
  } else {
    d = Math.hypot(px - jobs.target.x, py - jobs.target.y);
  }
  const needCar = step.inCar === true;
  const needComet = step.car === 'comet';
  const needVan = step.van === true;
  let ok = d < 70;
  if (needCar && !hero.inCar) ok = false;
  if (needComet && (!hero.inCar || hero.inCar.kind !== 'comet')) ok = false;
  if (needVan && (!hero.inCar || hero.inCar.kind !== 'van')) ok = false;
  if (!ok) return;
  jobs.step += 1;
  if (jobs.step >= job.steps.length) {
    hero.cash += job.pay;
    const finishedAll = jobs.index >= JOBS.length - 1;
    jobs.index += 1;
    jobs.step = 0;
    jobs.van = null;
    jobs.comet = null;
    if (finishedAll) {
      jobs.done = true;
      jobs.target = null;
      onComplete(job);
      return;
    }
    onComplete(job);
    onAdvance(startJob(jobs));
  } else {
    onAdvance(startJob(jobs));
  }
}
