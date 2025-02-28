
class SettlersState {


  /*
    Given a resource cost and player, check if they meet the minimum
    requirement = ["res1","res2"...]
  */
  doesPlayerHaveResources(player, requirement) {
    let myBank = this.game.state.players[player - 1].resources.slice();
    for (let x of requirement) {
      let ind = myBank.indexOf(x);
      if (ind >= 0) myBank.splice(ind, 1);
      else return false;
    }
    return true;
  }

  hasVPCards() {
    for (let i = 0; i < this.game.deck[0].hand.length; i++) {
      let cardname = this.game.deck[0].cards[this.game.deck[0].hand[i]].card;
      if (!this.isActionCard(cardname)) { return true; }
    }
    return false;
  }



	returnResources() {
		let newArray = [];
		for (let i of this.resources){
			if (i.count>1)
				newArray.push(i.name);
		}
		return newArray;
	}


	//
	// this should be returnCardImage, and the other function should be renamed somehow -- return resource image?
	//
  	returnResourceHTML(resource){
    		return `<div class="tip"><img class="icon" src="${this.returnCardImage(resource)}" /></div>`;
  	}



	returnCardImage(res) {
		for (let i of this.resources){
			if (i.name == res){
				if (i.card) {
				  return i.card;
				} else {
				  return `${this.cardDir}${res}.png`;
				}
			}

		}
		return null;	
	}


	returnHexes() {
		let hexes = [];
    		for (let i of this.resources){
    			for (let j = 0; j < i.count; j++){
    				if (i.tile) hexes.push({resource:i.name,img: i.tile});
    				else hexes.push({resource:i.name, img: this.randomizeTileImage(i)});
    			}

    		}
	    	return hexes;
	}

	returnDevelopmentCards(option){
		let deck = [];
		for (let i of this.deck){
    			for (let j = 0; j < i.count; j++){
    				deck.push(i);
    			}
	 	}
		return deck;
	}


	returnPortIcon(res){
		if (res === "any"){
			return `<img class="icon" src="/settlers/img/icons/any-port.png">`;
		}
		for (let i of this.resources){
			if (i.name == res){
				if (i.icon){
					return `<img class="icon" src="${i.icon.replace('-icon','-port')}">`;
				}
			}
		}
		return `2:1 ${this.resourceIcon(res)}`;	
	}


	returnNullResource(){
	   	for (let i of this.resources) {
	   		if (i.count==1) {
	   			return i.name;
	   		}
	   	}
	}

	isActionCard(cardname){
		for (let c of this.deck){
			if (cardname == c.card && c.action > 0) {
				return true;
			}
		}
		return false;
	}



	randomizeTileImage(resObj){
		let tileDir = "/settlers/img/sectors/";
		let x = Math.ceil(Math.random()*resObj.ict); 
		return tileDir+resObj.name+x+".png";
	}



  	returnDiceTokens() {
    		let dice = [];
    		dice.push({ value: 2 });
    		dice.push({ value: 12 });
    		for (let i = 3; i < 7; i++) {
    		    dice.push({ value: i });
    		    dice.push({ value: i });
    		    dice.push({ value: i + 5 });
    		    dice.push({ value: i + 5 });
    		}
    		return dice;
  	}



    returnCitySlotsAdjacentToPlayerRoads(player) {
        let adjacentVertices = [];

        //Cycle through roads to find all adjacent vertices
        for (let i = 0; i < this.game.state.roads.length; i++) {
            if (this.game.state.roads[i].player == player) {
                let slot = this.game.state.roads[i].slot.replace("road_", "");
                //console.log(this.game.state.roads[i],slot);
                for (let vertex of this.hexgrid.verticesFromEdge(slot))
                    if (!adjacentVertices.includes(vertex)) adjacentVertices.push(vertex);
            }
        }

        // Filter for available slots
        let existing_adjacent = [];
        for (let vertex of adjacentVertices) {
            let city = document.querySelector("#city_" + vertex);
            if (city && city.classList.contains("empty")) {
                existing_adjacent.push("city_" + vertex);
            }
        }
        //console.log(existing_adjacent);
        adjacent = existing_adjacent;
        return adjacent;
    }

    /*
    Used to prevent placing settlements too close together,
    for a given vertex coordinate, returns list of 2-3 adjacent vertices
    */
    returnAdjacentCitySlots(city_slot) {
        let adjacent = [];

        let vertexID = city_slot.replace("city_", "");
        for (let vertex of this.hexgrid.adjacentVertices(vertexID)) {
            adjacent.push("city_" + vertex);
        }
        //console.log("Vertex: ",city_slot," Neighbors: ",adjacent);
        return adjacent;
    }


    /*
      Set everything to zero by default
    */
    addSectorValuesToGameboard() {
        for (const i of this.hexgrid.hexes) {
            this.addSectorValueToGameboard(i, 0);
        }
    }

    addSectorValueToGameboard(hex, sector_value) {
        let selector = "hex_bg_" + hex;
        let hexobj = document.getElementById(selector);
        let svid = `sector_value_${hex}`;

        if (document.getElementById(svid)) {
            //Update Sector Value
            let temp = document.getElementById(svid);
            temp.textContent = sector_value;
            temp.classList.add("sv" + sector_value);
        } else {
            //Create Sector_value
            let sector_value_html = `
                <div class="sector-container sc${sector_value}" id="${svid}">
                    <div class="sector_value hexTileCenter sv${sector_value}" id="${svid}">${sector_value}</div>
                </div>
            `;
            let sector_value_obj = this.app.browser.htmlToElement(sector_value_html);
            if (hexobj) {
                hexobj.after(sector_value_obj);
            }
        }
        return svid;
    }

    /*
      Hardcode the position of resource ports
      Use road id + adjacent vertices for internal logic
    */
    addPortsToGameboard() {

        if (Object.keys(this.game.state.ports).length == 9) {
            //Just read the port information and call the function
            for (let p in this.game.state.ports) {
                let hex = p.substr(2);
                let dir = p[0];
                this.addPortToGameboard(hex, this.game.state.ports[p], dir);
            }
        } else {
            //Define the ports
            let resources = this.returnResources();
            let randomRoll = this.rollDice(2);
            let hexes, angles;
            if (randomRoll == 1) {
                hexes = ["1_1", "3_5", "5_4", "4_2"];
                angles = [6, 3, 3, 5];
            } else {
                hexes = ["1_2", "2_1", "5_3", "5_5"];
                angles = [1, 5, 4, 2];
            }

            for (let i = 0; i < hexes.length; i++) {
                this.addPortToGameboard(hexes[i], "any", angles[i]);
            }

            //Now do resource ports
            if (randomRoll == 1) {
                hexes = ["1_2", "2_1", "5_3", "5_5", "2_4"];
                angles = [1, 5, 4, 2, 1];
            } else {
                hexes = ["1_1", "3_5", "5_4", "4_2", "2_4"];
                angles = [6, 3, 3, 5, 1];
            }

            for (let i = 0; i < 5; i++) {
                let r = resources.splice(this.rollDice(resources.length) - 1, 1);
                this.addPortToGameboard(hexes[i], r, angles[i]);
            }
        }

    }

    addPortToGameboard(hex, port, direction) {
        let port_id = "port_" + direction + "_" + hex;

        this.game.state.ports[direction + "_" + hex] = port;

        if (!this.browser_active) { return; }

        let selector = "hex_bg_" + hex;
        let hexobj = document.getElementById(selector);
        if (!document.getElementById(port_id)) {
            let port_html = `<div class="port port${direction}" id="${port_id}">
                        <div class="ship hexTileCenter">${this.returnPortIcon(port)}</div>
                        <div class="harbor lharbor"></div>
                        <div class="harbor rharbor"></div>
                        </div>`;
            let port_obj = this.app.browser.htmlToElement(port_html);
            if (hexobj) hexobj.after(port_obj);
            //else console.log("Null selector: "+selector);
        }
    }

    /*
    Creates DOM stuctures to hold cities, 
    addCityToGameboard calculates where to (absolutely) position them
    */
    addCitiesToGameboard() {
        for (const i of this.hexgrid.hexes) {
            this.addCityToGameboard(i, 6);
            this.addCityToGameboard(i, 1);
        }
        //Right side corners
        this.addCityToGameboard("1_3", 2);
        this.addCityToGameboard("2_4", 2);
        this.addCityToGameboard("3_5", 2);
        this.addCityToGameboard("4_5", 2);
        this.addCityToGameboard("5_5", 2);

        this.addCityToGameboard("3_5", 3);
        this.addCityToGameboard("4_5", 3);
        this.addCityToGameboard("5_5", 3);

        //Left Under side
        this.addCityToGameboard("3_1", 5);
        this.addCityToGameboard("4_2", 5);
        this.addCityToGameboard("5_3", 5);
        //Bottom
        this.addCityToGameboard("5_3", 4);
        this.addCityToGameboard("5_4", 5);
        this.addCityToGameboard("5_4", 4);
        this.addCityToGameboard("5_5", 5);
        this.addCityToGameboard("5_5", 4);
    }

    /*
    Hexboard row_col indexed, city_component is point of hexagon (1 = top, 2 = upper right, ... )
    */
    addCityToGameboard(hex, city_component) {
        //let el = document.querySelector('.game-hexgrid-cities');
        //let hexobj = document.getElementById(hex);
        let city_id = "city_" + city_component + "_" + hex;

        let selector = "hex_bg_" + hex;
        let hexobj = document.getElementById(selector);
        if (!document.getElementById(city_id)) {
            let city_html = `<div class="city city${city_component} empty" id="${city_id}"></div>`;
            let city_obj = this.app.browser.htmlToElement(city_html);
            if (hexobj) hexobj.after(city_obj);
            //else console.log("Null selector: "+selector);
        }
    }


    addRoadToGameboard(hex, road_component) {
        let selector = "hex_bg_" + hex;
        let hexobj = document.getElementById(selector);
        let road_id = "road_" + road_component + "_" + hex;
        //console.log("Add road to gameboard: "+road_id);
        if (!document.getElementById(road_id)) {
            let road_html = `<div class="road road${road_component} empty" id="${road_id}"></div>`;
            let road_obj = this.app.browser.htmlToElement(road_html);
            if (hexobj) hexobj.after(road_obj);
            //else console.log("Null selector: "+selector);
        }
    }


    //Allow this player to click buttons to display resource or dev cards in their cardfan
    addEventsToHand() {
        let settlers_self = this;

        $(".cardselector").off(); //Previous events should be erased when the dom is rebuilt, but just in case...
        $(".cardselector").on("click", function () {
            settlers_self.displayCardfan($(this).attr("id"));
        });
    }

    removeEvents() {
        //console.trace("remove events");
        this.displayBoard();
        $(".cardselector").off();
        $(".trade").off();
    }

}

module.exports = SettlersState;
