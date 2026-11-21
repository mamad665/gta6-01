// missions.js — the story: four jobs for Rosa Delgado, chained in order.
// Each mission is a list of steps; a step completes when the player reaches
// its marker (or, for the van job, when the target car is stopped).

import { dist } from './random.js';
import { makeCar } from './entities.js';

export const MISSION_DEFS = [
  {
    id: 'first-job',
    title: 'Job 1 — First Run',
    briefing:
      'Rosa: "A package is waiting at Port Docks. Bring it back to my garage. ' +
      'No questions, no cops. Easy money, Marco."',
    reward: 500,
    steps: [
      { text: 'Drive to Port Docks and pick up the package', target: 'docks', radius: 90 },
      { text: 'Bring the package back to Rosa\'s Garage', target: 'garage', radius: 90 },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Job 2 — Hot Wheels',
    briefing:
      'Rosa: "A client wants the yellow Comet GT parked by Sunset Mall. ' +
      'Take it. If the owner complains, you were never there."',
    reward: 800,
    steps: [
      { text: 'Steal the yellow Comet GT by Sunset Mall (press E near it)', target: 'sportCar', radius: 70 },
      { text: 'Deliver the Comet GT to Rosa\'s Garage', target: 'garage', radius: 90, needCar: 'sport' },
    ],
  },
  {
    id: 'the-drop',
    title: 'Job 3 — The Drop',
    briefing:
      'Rosa: "The package goes to the Marina, Pier 9 side. The PD is jumpy ' +
      'tonight — keep it clean and be quick about it."',
    reward: 1200,
    steps: [
      { text: 'Pick up the drop at Rosa\'s Garage', target: 'garage', radius: 90 },
      { text: 'Deliver the drop to the Marina', target: 'marina', radius: 90 },
    ],
  },
  {
    id: 'bank-van',
    title: 'Job 4 — Bank Van Blues',
    briefing:
      'Rosa: "Last one, big one. A Solmar Bank van rolls past City Hall at noon. ' +
      'Stop it, take the cash, and lose the cops at Pier 9. Then we\'re even."',
    reward: 2500,
    steps: [
      { text: 'Intercept the bank van near City Hall — ram it or shoot it until it stops', target: 'bankVan', radius: 60 },
      { text: 'Grab the cash from the van (walk over it)', target: 'cashPile', radius: 60 },
      { text: 'Lose the cops — reach the Hideout at Pier 9', target: 'hideout', radius: 90 },
    ],
  },
];

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.index = 0; // which mission is active
    this.step = 0; // which step of it
    this.done = false; // all missions complete
    this.cashPile = null; // {x, y} after the van is stopped
    this.sportCar = null; // the yellow Comet GT (spawned for job 2)
    this.bankVan = null; // the bank van (spawned for job 4)
    this.toast = '';
    this.toastTimer = 0;
  }

  current() {
    if (this.done) return null;
    return MISSION_DEFS[this.index];
  }

  currentStep() {
    const m = this.current();
    if (!m) return null;
    return m.steps[this.step];
  }

  // World position of the active step's marker (null when there is none).
  markerPos() {
    const step = this.currentStep();
    if (!step) return null;
    const lm = this.game.city.landmarks;
    if (step.target === 'sportCar') {
      return this.sportCar ? { x: this.sportCar.x, y: this.sportCar.y } : null;
    }
    if (step.target === 'bankVan') {
      return this.bankVan ? { x: this.bankVan.x, y: this.bankVan.y } : null;
    }
    if (step.target === 'cashPile') {
      return this.cashPile;
    }
    const place = lm[step.target];
    return place ? { x: place.x, y: place.y } : null;
  }

  objectiveText() {
    if (this.done) return 'All jobs done — Solmar City is yours. (Missions reset on New Game)';
    const m = this.current();
    const s = this.currentStep();
    return m.title + ' — ' + s.text;
  }

  startMission(i) {
    this.index = i;
    this.step = 0;
    const m = this.current();
    if (m) {
      this.game.toast(m.title, 5);
      this.game.sound.missionDone();
    }
    if (m && m.id === 'hot-wheels') this.spawnSportCar();
    if (m && m.id === 'bank-van') this.spawnBankVan();
  }

  spawnSportCar() {
    const lm = this.game.city.landmarks.mall;
    const car = makeCar(lm.x + 150, lm.y + 60, 0, {
      color: '#e8b62a',
      kind: 'sport',
      driver: null,
      isTarget: true,
    });
    car.isTarget = true;
    this.sportCar = car;
    this.game.cars.push(car);
  }

  spawnBankVan() {
    const lm = this.game.city.landmarks.cityHall;
    const van = makeCar(lm.x + 260, lm.y, Math.PI, {
      color: '#3f5a7a',
      kind: 'van',
      driver: 'traffic',
      cruise: 150,
      isTarget: true,
    });
    van.isTarget = true;
    van.target = { x: lm.x - 400, y: lm.y };
    this.bankVan = van;
    this.game.cars.push(van);
  }

  onTargetCarDisabled() {
    // The bank van was shot to a stop: drop the cash pile beside it.
    if (this.current() && this.current().id === 'bank-van' && this.bankVan) {
      if (!this.cashPile) {
        this.cashPile = { x: this.bankVan.x + 50, y: this.bankVan.y + 30 };
        this.game.toast('The van is stopped! Grab the cash!', 4);
      }
    }
  }

  update(dt) {
    const m = this.current();
    if (!m) return;
    const step = this.currentStep();
    const p = this.game.player;
    const pos = this.markerPos();
    if (!pos) return;

    if (step.target === 'sportCar') {
      // Step completes when the player is driving the Comet GT.
      if (p.inCar === this.sportCar) {
        this.game.addWanted(2, 'grand theft auto');
        this.completeStep();
      }
      return;
    }
    if (step.target === 'bankVan') {
      // The van must be stopped (rammed to 0 health or shot out).
      if (this.bankVan && this.bankVan.health <= 0) {
        this.onTargetCarDisabled();
        this.completeStep();
      }
      return;
    }

    const d = dist(p.x, p.y, pos.x, pos.y);
    const needCar = step.needCar;
    if (d < step.radius) {
      if (needCar && !(p.inCar && p.inCar.kind === needCar)) return;
      this.completeStep();
    }
  }

  completeStep() {
    const m = this.current();
    this.step += 1;
    this.game.sound.pickup();
    if (this.step >= m.steps.length) {
      // Mission complete: pay out and chain the next one.
      this.game.player.cash += m.reward;
      this.game.toast(m.title + ' complete! +$' + m.reward, 4);
      this.game.sound.missionDone();
      this.game.save();
      this.index += 1;
      this.step = 0;
      if (this.index >= MISSION_DEFS.length) {
        this.done = true;
        this.game.storyComplete();
      } else {
        this.startMission(this.index);
      }
    } else {
      this.game.toast('Next: ' + this.currentStep().text, 4);
    }
  }
}
