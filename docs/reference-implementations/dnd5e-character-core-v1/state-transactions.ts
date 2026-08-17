// Reference implementation only. Database transaction wiring belongs in production.

import type { Dnd5eCharacterState, Dnd5eLevelRecord } from "./domain";
import { canGainAnotherLevel, characterLevel, classDefinition, classTotals, maximumHitPoints } from "./state-helpers";
import { nextLevelExperience } from "./core-tables";
import { validateLevelRecordShape } from "./creation-and-levelup";
import { baseLandSpeed, attacksPerAttackAction } from "./combat-resolver";
import { ancestryDefinition } from "./origin";

export type Dnd5eXpReason="challenge"|"roleplay"|"quest"|"story"|"admin"|"migration";
export type Dnd5eXpEvent={eventKey:string;amount:number;reason:Dnd5eXpReason;summary:string;sourceMessageId?:number};
export type Dnd5eLevelEvent={eventKey:string;characterLevel:number;classId:string;classLevel:number;summary:string};

export type Dnd5eCompatibilityProjection={
  race:string;
  charClass:string;
  level:number;
  maxHp:number;
  speed:number;
  attacksPerRound:number;
};

export type TransactionResult<T>={state:Dnd5eCharacterState;event:T;projection:Dnd5eCompatibilityProjection};

export function compatibilityProjection(state:Dnd5eCharacterState):Dnd5eCompatibilityProjection{
  const totals=classTotals(state.levels);
  const charClass=Object.entries(totals).map(([id,total])=>`${classDefinition(state,id)?.displayName??id} ${total}`).join(" / ")||"Unresolved";
  return {
    race:ancestryDefinition(state)?.displayName??state.origin.ancestryId,
    charClass,
    level:characterLevel(state),
    maxHp:maximumHitPoints(state),
    speed:baseLandSpeed(state,[]),
    attacksPerRound:attacksPerAttackAction(state),
  };
}

export function awardValidatedXp(state:Dnd5eCharacterState,input:Dnd5eXpEvent):TransactionResult<Dnd5eXpEvent>{
  if(!input.eventKey.trim()) throw new Error("XP event requires an idempotency key.");
  if(!Number.isInteger(input.amount)||input.amount<0) throw new Error("XP must be a non-negative integer.");
  if(!input.summary.trim()) throw new Error("XP event requires an auditable summary.");
  const next={...state,experiencePoints:state.experiencePoints+input.amount};
  return {state:next,event:input,projection:compatibilityProjection(next)};
}

export function commitLevel(
  state:Dnd5eCharacterState,
  input:{eventKey:string;level:Dnd5eLevelRecord;advancementMode:"xp"|"milestone";milestoneApproved?:boolean},
):TransactionResult<Dnd5eLevelEvent>{
  if(!input.eventKey.trim()) throw new Error("Level event requires an idempotency key.");
  if(state.levels.length>=1){
    if(input.advancementMode==="xp"&&!canGainAnotherLevel(state)) throw new Error(`Need ${nextLevelExperience(characterLevel(state))} XP for character level ${characterLevel(state)+1}.`);
    if(input.advancementMode==="milestone"&&!input.milestoneApproved) throw new Error("Milestone level-up requires an explicit validated milestone event.");
  }
  const errors=validateLevelRecordShape(state,input.level);
  if(errors.length) throw new Error(`Cannot commit D&D 5e level:\n- ${errors.join("\n- ")}`);
  const next={...state,levels:[...state.levels,input.level]};
  const cls=classDefinition(next,input.level.classId);
  const event:Dnd5eLevelEvent={eventKey:input.eventKey,characterLevel:input.level.characterLevel,classId:input.level.classId,classLevel:input.level.classLevel,summary:`Committed character level ${input.level.characterLevel} as ${cls?.displayName??input.level.classId} ${input.level.classLevel}.`};
  return {state:next,event,projection:compatibilityProjection(next)};
}

export const TRANSACTION_REQUIREMENTS=[
  "Persist every XP/level/state event with a unique eventKey so retries are idempotent.",
  "Load canonical state and revision, validate, write new state/event/projection, and advance revision atomically.",
  "Reject stale revisions rather than last-write-wins overwriting permanent player choices.",
  "Do not trust client-supplied AC, proficiency bonus, spell DC, skill totals, max HP, attacks per action or derived saves.",
  "A Claude proposal is input evidence, not write authority.",
  "Broadcast WebSocket updates only after the database commit succeeds.",
  "Snapshot/rewind must restore this state and its event ledger consistently with items/effects/currency.",
] as const;
