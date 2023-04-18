module.exports = SettlersRulesOverlayTemplate = (rules) => {

  return `
  <div class="saitoa rules-overlay trade_overlay">
  <div class="h1">${rules.mod.skin.gametitle}</div>
  <div class="h2">Overview</div>
  <p>The game mechanics should be familiar to anyone who has played resource-acquisition boardgames based on trading and building.</p>
  <div class="h2">Set up</div>
  <p>Each player gets to place 2 ${rules.mod.skin.c1.name}s and 2 adjoining ${rules.mod.skin.r.name}s anywhere on the board during the initial setup. <em>Note: </em> ${rules.mod.skin.c1.name}s may not be placed on adjacent corners (i.e. only seperated by a single ${rules.mod.skin.r.name}, whether or not one is actually built).</p>
  <p>The order of placement reverses so that last player to place their first ${rules.mod.skin.c1.name} is the first to place their second ${rules.mod.skin.c1.name}. Each player starts with resource cards from the tiles adjacent to their second placed ${rules.mod.skin.c1.name}.</p>
  <div class="h2">Game Play</div>
  <p>Each player's turn consists of a number of moves: roll, trade, build, buy card, play card. They begin by rolling the dice. The number of the roll determines which tiles produce resources (see section on ${rules.mod.skin.b.name}). Players with ${rules.mod.skin.c1.name}s on the producing tiles collect resources from those tiles.</p>
  <p>Players may then trade with each other or with the "bank." Trades with the bank require 4 identical resources to be exchanged for any other resource. However, if players have a ${rules.mod.skin.c1.name} adjacent to a trade ship, they can get a better rate with the "bank." There are no restrictions on trades between players, who may trade any number of resources. Once a player has bought a card or built something, they may no longer make trades during their turn. All trades must involve the player whose turn it is.</p>
  <div class="h3">Building and Costs</div>
  <p>After the player is satisfied with their trades (if any), they may build something or purchase a ${rules.mod.skin.card.name} card. Players must have sufficient resources to afford the purchases, as defined below:</p>
  <ul style="margin-left:2em"> <li>A ${rules.mod.skin.r.name} costs ${rules.mod.skin.priceList[0]}</li>
  <li>A ${rules.mod.skin.c1.name} costs ${rules.mod.skin.priceList[1]}</li>
  <li>A ${rules.mod.skin.c2.name} costs ${rules.mod.skin.priceList[2]}</li>
  <li>A ${rules.mod.skin.card.name} card costs ${rules.mod.skin.priceList[3]}</li></ul>
  <p> A ${rules.mod.skin.c2.name} replaces an already built ${rules.mod.skin.c1.name} and collects double the resources of a ${rules.mod.skin.c1.name}.</p>
  <div class="h3" style="text-transform:capitalize">${rules.mod.skin.b.name}</div>
  <p>If a 7 is rolled, the ${rules.mod.skin.b.name} comes into play. The ${rules.mod.skin.b.name} does 3 things. First, any players with more than 7 resource cards must discard half their hand. Second, the rolling player may move the ${rules.mod.skin.b.name} to any tile. The ${rules.mod.skin.b.name} may steal one resource from any player with a ${rules.mod.skin.c1.name} or ${rules.mod.skin.c2.name} adjacent to the affected tile. Third, that tile is deactivate by the presence of the ${rules.mod.skin.b.name} and will not produce resources until the ${rules.mod.skin.b.name} is moved. The ${rules.mod.skin.b.name} will be moved on the next roll of a 7 or if a player purchases and plays a ${rules.mod.skin.s.name} from the ${rules.mod.skin.card.name} cards.</p>
  <div class="h3" style="text-transform:capitalize">${rules.mod.skin.card.name} cards</div>
  <p>There are many kinds of ${rules.mod.skin.card.name} cards, though the aforementioned ${rules.mod.skin.s.name} is the most common type. Some allow the player to perform a special action (such as building additional ${rules.mod.skin.r.name} at no cost or collecting additional resources), while others give the player an extra ${rules.mod.skin.vp.name}. Players may play a ${rules.mod.skin.card.name} card at any time during their turn (including before the roll), but may only play one per turn and only on the turn after purchasing it. ${rules.mod.skin.card.name} cards which give +1 ${rules.mod.skin.vp.name} are exempt from these restrictions.</p>
  <div class="h2">Winning the Game</div>
  <p>${rules.mod.skin.vp.name} are important because the first player to accumulate 10 ${rules.mod.skin.vp.name} is declared the winner of the game. Players earn 1 ${rules.mod.skin.vp.name} per ${rules.mod.skin.c1.name} and 2 ${rules.mod.skin.vp.name}s for every ${rules.mod.skin.c2.name} they have built. There are also two special achievements worth 2 ${rules.mod.skin.vp.name}s each.</p>
  <p> The player with the longest contiguous ${rules.mod.skin.r.name} of at least 5 is awarded the "${rules.mod.skin.longest.name}" badge. Similarly, if a player accumulates at least 3 ${rules.mod.skin.s.name}s, they are awarded the "${rules.mod.skin.largest.name}" badge. Only one player may hold either badge, and other players must surpass them to claim it for themselves.</p>
  <div class="h2">FAQ</div>
  <dl>
  <dt>Why can't I build a ${rules.mod.skin.c1.name}?</dt>
  <dd>In order to build a ${rules.mod.skin.c1.name}, you have to satisfy several requirements. Firstly, you must have all the resources required to build. Secondly, you must have an available spot on the board, which is both connected to one of your roads and not adjacent to any other ${rules.mod.skin.c1.name}s or ${rules.mod.skin.c2.name}s. Thirdly, you many only have up to 5 ${rules.mod.skin.c1.name}s on the board at any time. Try upgrading one of your ${rules.mod.skin.c1.name}s to a ${rules.mod.skin.c2.name}. </dd>
  <dt>Why can't I build a ${rules.mod.skin.c2.name}?</dt>
  <dd>See the above answer, but note that you are limited to 4 ${rules.mod.skin.c2.name}s on the board.</dd>
  </dl>
  </div>
  `;

}