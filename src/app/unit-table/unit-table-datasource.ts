import { DataSource } from '@angular/cdk/collections';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Observable, of as observableOf, merge } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import * as rumble from '../model/rumble';
import rumbleData from '../../assets/data/rumble.json';

declare const window: any;

export class UnitDetails {
  complete: boolean;
  id: number;
  isBaseForm: boolean;
  name: string;
  baseHp: number;
  baseAtk: number;
  baseRcv: number;
  baseDef: number;
  baseSpd: number;
  rumbleType: string;
  type: string;
  class1: string;
  class2: string;
  festAbility: string;
  festSpecial: string;
  festCooldown: string;
  festAttackPattern: string;
  festAttackTarget: string;

/*
  private computeDefPercentage(): number {
    return 9.6671298720642E-17 * this.baseDef ** 6
            - 2.54940335570173E-13 * this.baseDef ** 5
            + 0.000000000265685114974299 * this.baseDef ** 4
            - 0.000000135059490498531 * this.baseDef ** 3
            + 0.000030881486606793 * this.baseDef ** 2
            - 0.000309272395298876 * this.baseDef
            + 0.00126339332598491 * 100;
  }

  public getId(): number { return this.id; }
  public getName(): string { return this.name; }
  public getBaseHp(): number { return this.baseHp; }
  public getBaseAtk(): number { return this.baseAtk; }
  public getBaseRcv(): number { return this.baseRcv; }
  public getBaseDef(): number { return Math.round((this.computeDefPercentage() + Number.EPSILON) * 100) / 100; }
  public getBaseSpd(): number { return this.baseSpd; }
  public getRumbleType(): string { return this.rumbleType; }
  public getType(): string { return '<span class="badge text-monospace badge-pill ' + this.type + '">' + this.type + '</span>'; }
  public getFestAbility(): string { return this.encodeText(this.festAbility[4].description); }
  public getFestSpecial(): string { return this.encodeText(this.festSpecial[9].description); }
  public getFestAttackPattern(): string { return this.festAttackPattern; }
  public getFestAttackTarget(): string { return this.festAttackTarget; }

  private encodeText(s: string): string
  {
    return s.replace(/\[([A-Z]+)\]/gi,
                     '<span class="badge text-monospace badge-pill $1">$1</span>');
  }
  */
}

/**
 * Data source for the UnitTable view. This class should
 * encapsulate all logic for fetching and manipulating the displayed data
 * (including sorting, pagination, and filtering).
 */
@Injectable({
   providedIn: 'root'
 })
export class UnitTableDataSource extends MatTableDataSource<rumble.Unit> {
  database: rumble.Unit[] = [];

  filterChainSubject: BehaviorSubject<((unit: rumble.Unit) => boolean) []>
   = new BehaviorSubject<((unit: rumble.Unit) => boolean) []>([unit => !unit.isBaseForm]);

  constructor() {
    super();

    let unitDetail: UnitDetails;
    const unitDetails: UnitDetails[] = [];
    let unit: rumble.Unit;
    const units: rumble.Entry[] = rumbleData.units as rumble.Entry[];

    for (let i = 0; i < window.units.length; i++){
      if (i === 3134 || i === 3133) { // Deal with VS unit later
        continue;
      }
      if (window.units[i].incomplete ){
          continue;
      }
      unitDetail = new UnitDetails();
      unitDetail.id = i + 1;
      unitDetail.complete = !window.units[i].incomplete;
      if (!unitDetail.complete) {
        unitDetails.push(unitDetail);
        continue;
      }
      unitDetail.isBaseForm = window.evolutions[i + 1];
      unitDetail.name = window.units[i][0];
      unitDetail.baseHp = window.units[i][12];
      unitDetail.baseAtk = window.units[i][13];
      unitDetail.baseRcv = window.units[i][14];
      unitDetail.type = Array.isArray(window.units[i][1]) ? 'DUAL' : window.units[i][1];
      if (Array.isArray(window.units[i][2])) {
        if (Array.isArray(window.units[i][2][0])) { // dual unit
          unitDetail.class1 = window.units[i][2][2][0];
          unitDetail.class2 = window.units[i][2][2][1];
        } else { // Double class Unit
          unitDetail.class1 = window.units[i][2][0];
          unitDetail.class2 = window.units[i][2][1];
        }
      } else { // Single class unit
        unitDetail.class1 = window.units[i][2];
      }
      unitDetails.push(unitDetail);
    }

    for (let i = 0; i < units.length; i++){
      if ('basedOn' in units[i]) {
        const baseUnit: rumble.Unit = units.find(u => u.id === (units[i] as rumble.Reference).basedOn) as rumble.Unit;
        if (baseUnit === null) {
          console.log( ' Failed to locate Base Unit!!!!!!! ' + i);
          console.log(units[i]);
          continue;
        }
        unit = JSON.parse(JSON.stringify(baseUnit));
        unit.id = units[i].id;
      } else {
        unit = (JSON.parse(JSON.stringify(units[i])) as rumble.Unit);
      }
      unitDetail = unitDetails.find(ud => ud.id === unit.id);
      if (unitDetail === null) {
        console.log( ' Failed to locate Base Unit Details!!!!!!!!!!! ' + i);
        console.log(unit);
        continue;
      }
      if (!unitDetail.complete){
        console.log( 'Skipping unit ' + unit.id + ', the unit is not complete.');
        continue;
      }
      if (unitDetail.name.includes('[Dual Unit] ')) {
        continue;
      }

      this.denormalizeEffects(unit.ability);
      this.denormalizeEffects(unit.special);

      unit.name = unitDetail.name;
      unit.isBaseForm = unitDetail.isBaseForm;
      unit.stats.hp = unitDetail.baseHp;
      unit.stats.atk = unitDetail.baseAtk;
      unit.stats.rcv = unitDetail.baseRcv;
      unit.stats.type = unitDetail.type;
      unit.stats.class1 = unitDetail.class1;
      unit.stats.class2 = unitDetail.class2;

      unit.lvl5Ability = (unit.ability[4].effects as rumble.Effect[]);
      unit.lvl10Special = (unit.special[9].effects as rumble.Effect[]);
      unit.lvl10Cooldown = unit.special[9].cooldown;
      this.database.push(unit);
    }

    this.filterData();

  }

  denormalizeEffects(levels: rumble.Ability[]|rumble.Special[]): void {
    const lastEffect: rumble.Effect[] = [];
    let mergedEffect: rumble.Effect[] = [];

    levels.forEach( (level, levelIdx) => {
      mergedEffect = [...lastEffect];
      level.effects.forEach((effect: rumble.Effect | rumble.EffectOverride, effectIdx) => {
        if ('effect' in effect) {
          lastEffect[effectIdx] = (effect as rumble.Effect);
          mergedEffect[effectIdx] = (effect as rumble.Effect);
        } else if ('override' in effect){
          mergedEffect[effectIdx] = {...lastEffect[effectIdx], ...(effect as rumble.EffectOverride).override};
        }
      });
      level.effects = mergedEffect;
    });
  }

  filterData(): void {
    let tmpData: rumble.Unit[] = this.database;
    this.filterChainSubject.value.forEach(unitFilter => tmpData = tmpData.filter(unitFilter));
    this.data = tmpData;
    this._updateChangeSubscription();
  }

  /**
   * Sort the data (client-side). If you're using server-side sorting,
   * this would be replaced by requesting the appropriate data from the server.
   */
/*
  private getSortedData(data: Unit[]): Unit[] {
    if (!this.sort.active || this.sort.direction === '') {
      return data;
    }

    return data.sort((a, b) => {
      const isAsc = this.sort.direction === 'asc';
      switch (this.sort.active) {
        case 'name': return compare(a.name, b.name, isAsc);
        case 'id': return compare(+a.id, +b.id, isAsc);
        case 'baseHp': return compare(+a.stats.hp, +b.stats.hp, isAsc);
        case 'baseAtk': return compare(+a.stats.atk, +b.stats.atk, isAsc);
        case 'baseRcv': return compare(+a.stats.rcv, +b.stats.rcv, isAsc);
        case 'baseDef': return compare(+a.stats.def, +b.stats.def, isAsc);
        case 'baseSpd': return compare(+a.stats.spd, +b.stats.spd, isAsc);
        case 'lvl10Cooldown': return compare(+a.lvl10Cooldown, +b.lvl10Cooldown, isAsc);
        default: return 0;
      }
    });
  }
}*/

/** Simple sort comparator for example ID/Name columns (for client-side sorting). */
/*function compare(a: string | number, b: string | number, isAsc: boolean): number {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}*/
}
