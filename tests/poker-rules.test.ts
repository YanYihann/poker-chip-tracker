import assert from 'node:assert/strict';
import { test } from 'node:test';
import { replayBettingRound, legalBettingActions, buildContributionPots, splitPotClockwise } from '../server/src/modules/rooms/betting-round';
import { assignPositions, buildActionOrder } from '../src/features/table/rules';
import { startLocalHand, debugRunTableAction } from '../src/features/table/useTableController';
import { useSessionStore } from '../src/store/useSessionStore';
import { useHandStore } from '../src/store/useHandStore';
import { useBettingStore } from '../src/store/useBettingStore';

function setup(count = 3, stacks?: number[]) {
  useSessionStore.getState().setPlayerCount(count);
  if (stacks) useSessionStore.getState().setPlayers(useSessionStore.getState().players.map((p,i)=>({...p,stack:stacks[i]})));
  startLocalHand();
}
function total() {return useSessionStore.getState().players.reduce((n,p)=>n+p.stack,0)+useBettingStore.getState().pot;}

test('position assignment terminates after folds and heads-up dealer posts SB',()=>{
  setup(3);
  const players = useSessionStore.getState().players.map((p,i)=>({...p,status:i===1?'folded' as const:p.status}));
  assert.equal(assignPositions(players,0).length,3);
  setup(2);
  const heads=useSessionStore.getState().players;
  assert.equal(heads[0].position,'BTN/SB');
  assert.equal(heads[0].currentBet,100);
  assert.deepEqual(buildActionOrder(heads,0,'preflop'),[heads[0].id,heads[1].id]);
  assert.deepEqual(buildActionOrder(heads,0,'flop'),[heads[1].id,heads[0].id]);
});
test('BB retains option after limps, and a raise returns action to earlier callers',()=>{
  setup(); const initial=total();
  debugRunTableAction('call'); debugRunTableAction('call');
  assert.equal(useHandStore.getState().street,'preflop');
  assert.equal(useHandStore.getState().actingPlayerId,'player-3');
  debugRunTableAction('raise');
  assert.equal(useHandStore.getState().street,'preflop');
  assert.equal(useHandStore.getState().actingPlayerId,'player-1');
  debugRunTableAction('call'); debugRunTableAction('call');
  assert.equal(useHandStore.getState().street,'flop'); assert.equal(total(),initial);
});
test('fold and all-in actor removal never skips a pending caller',()=>{
  setup(); debugRunTableAction('fold');
  assert.equal(useHandStore.getState().actingPlayerId,'player-2');
  setup(3,[1000,500,1000]); debugRunTableAction('all-in');
  assert.equal(useHandStore.getState().actingPlayerId,'player-2');
  debugRunTableAction('call');
  assert.equal(useHandStore.getState().actingPlayerId,'player-3');
  debugRunTableAction('call');
  assert.equal(useHandStore.getState().status,'pre-settlement');
  assert.equal(useBettingStore.getState().pot,2500);
});
test('no artificial side betting against all-ins, and uncalled chips are refunded',()=>{
  setup(2,[1000,300]); const initial=total();
  debugRunTableAction('all-in'); debugRunTableAction('call');
  assert.equal(useBettingStore.getState().pot,600);
  assert.equal(useSessionStore.getState().players[0].stack,700);
  assert.equal(useHandStore.getState().street,'showdown'); assert.equal(total(),initial);
});
test('settlement is single-use, undo restores chips and reopening cannot pay twice',()=>{
  setup(2); const initial=total(); debugRunTableAction('fold');
  debugRunTableAction('quick-win'); assert.equal(total(),initial);
  const won=useSessionStore.getState().players[1].stack;
  debugRunTableAction('quick-win'); assert.equal(useSessionStore.getState().players[1].stack,won);
  debugRunTableAction('reopen-settlement'); assert.equal(useHandStore.getState().status,'pre-settlement');
  debugRunTableAction('quick-win'); assert.equal(total(),initial);
});
test('all players check through four streets and next hand rotates dealer',()=>{
  setup(2); debugRunTableAction('call'); debugRunTableAction('check');
  for(let i=0;i<6;i++) debugRunTableAction('check');
  assert.equal(useHandStore.getState().status,'pre-settlement');
  debugRunTableAction('quick-win'); startLocalHand(true);
  assert.equal(useSessionStore.getState().dealerSeatIndex,1);
  assert.equal(useHandStore.getState().street,'preflop');
});
test('short all-in does not reopen a full raise, cumulative short raises do',()=>{
  const round=replayBettingRound([
    {playerId:'a',actionType:'BET',amount:100},
    {playerId:'b',actionType:'RAISE',amount:300},
    {playerId:'c',actionType:'ALL_IN',amount:350},
  ],100);
  assert.equal(round.minRaiseDelta,200);
  const input={stack:1000,playerBet:300,currentBet:350,minRaiseDelta:200,bigBlind:100,lastActedBet:300,canOpponentRespond:true};
  assert.deepEqual(legalBettingActions(input),['fold','call']);
  assert.ok(legalBettingActions({...input,currentBet:500}).includes('raise'));
});
test('BB check/raise, unopened bet, underfunded call, and isolated stack actions',()=>{
  const input={stack:1000,playerBet:200,currentBet:200,minRaiseDelta:200,bigBlind:200,canOpponentRespond:true};
  assert.deepEqual(legalBettingActions(input),['fold','check','raise','all-in']);
  assert.deepEqual(legalBettingActions({...input,stack:100,playerBet:0,currentBet:500}),['fold','call','all-in']);
  assert.deepEqual(legalBettingActions({...input,currentBet:0,playerBet:0}),['fold','check','bet','all-in']);
  assert.deepEqual(legalBettingActions({...input,canOpponentRespond:false}),['fold','check']);
});
test('main/side/uncalled layers conserve chips and odd chips go clockwise after dealer',()=>{
  const pots=buildContributionPots([{playerId:'a',amount:100},{playerId:'b',amount:300},{playerId:'c',amount:500}]);
  assert.deepEqual(pots.map(p=>p.amount),[300,400,200]);
  assert.deepEqual(pots[1].participants,['b','c']);
  assert.deepEqual(splitPotClockwise(11,[{playerId:'a',seatIndex:0},{playerId:'b',seatIndex:4},{playerId:'c',seatIndex:7}],4),{c:4,a:4,b:3});
});

test('busted seats are skipped on the next hand while positions stay fixed after folding',()=>{
  setup(4,[2000,0,2000,2000]);
  const players = useSessionStore.getState().players;
  assert.equal(players[0].position,'BTN');
  assert.equal(players[1].position,undefined);
  assert.equal(players[2].position,'SB');
  assert.equal(players[3].position,'BB');
  debugRunTableAction('fold');
  assert.equal(useSessionStore.getState().players[2].position,'SB');
  assert.equal(useHandStore.getState().actingPlayerId,'player-3');
});
