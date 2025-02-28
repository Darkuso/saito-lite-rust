import * as JSON from "json-bigint";
import Transaction from "./transaction";
import { Saito } from "../../apps/core";
import Block from "./block";

class Storage {
  public app: Saito;
  public active_tab: any;

  constructor(app) {
    this.app = app || {};
    this.active_tab = 1; // TODO - only active tab saves, move to Browser class
  }

  async initialize() {
    await this.loadOptions();
    this.saveOptions();
    return;
  }

  async loadOptions() {
    if (typeof Storage !== "undefined") {
      const data = localStorage.getItem("options");
      if (data != "null" && data != null) {
        this.app.options = JSON.parse(data);
      } else {
        try {
          const response = await fetch(`/options`);
          this.app.options = await response.json();
          this.saveOptions();
        } catch (err) {
          console.error(err);
        }
      }
    }
  }
  returnClientOptions(): string {
    throw new Error("Method not implemented.");
  }

  //
  // HOW THE STORAGE CLASS SAVES TXS
  //
  // modules call ---> app.storage.saveTransaction(tx, obj, peer))
  //    ---> saveTransaction() creates TX type="archive" / request="save" transaction
  //    ---> saveTransaction() directs this transaction to:
  //                    "localhost"   ==> its own archive module
  //      peer    ==> this specific peer via offchain handlePeerTransaction() request)
  //      null    ==> all peers via offchain handlePeerTransaction() request)
  //    ---> peers receive via Archive module
  //    ---> peers save to DB
  //
  // HOW THE STORAGE CLASS LOADS TXS
  //
  // modules call ---> app.storage.loadTransactions()
  //    ---> loadTransactions() creates TX type="archive" / request="load" transaction
  //    ---> loadTransactions() directs this transaction to:
  //                    "localhost"   ==> its own archive module
  //      peer    ==> this specific peer via offchain handlePeerTransaction() request)
  //      null    ==> all peers via offchain handlePeerTransaction() request)
  //    ---> peers receive via Archive module
  //    ---> peers fetch from DB, return via callback or return TX
  //
  async saveTransaction(tx, obj = {}, peer = null) {
    const txmsg = tx.returnMessage();
    const message = "archive";

    let data: any = {};
    data.request = "save";
    data.tx = tx;

    data = Object.assign(data, obj);

    if (!data.field1) {
      data.field1 = txmsg.module;
    }
    if (!data.field2) {
      data.field2 = tx.transaction.from[0].add;
    }
    if (!data.field3) {
      data.field3 = tx.transaction.to[0].add;
    }

    if (peer === "localhost") {
      let archive_mod = this.app.modules.returnModule("Archive");
      if (archive_mod) {
        let res = archive_mod.saveTransaction(tx, data);
      }
      this.app.connection.emit("saito-save-transaction", tx);
      return;
    }
    if (peer != null) {
      peer.sendRequestWithCallback(message, data, function (res) {});
      this.app.connection.emit("saito-save-transaction", tx);
      return;
    } else {
      this.app.network.sendRequestWithCallback(message, data, function (res) {});
      this.app.connection.emit("saito-save-transaction", tx);
      return;
    }
  }

  async updateTransaction(tx, obj = {}, peer = null) {
    const txmsg = tx.returnMessage();
    const message = "archive";
    let data: any = {};
    data.request = "update";
    data.tx = tx;
    data = Object.assign(data, obj);

    if (peer === "localhost") {
      let archive_mod = this.app.modules.returnModule("Archive");
      if (archive_mod) {
        let res = archive_mod.updateTransaction(tx, obj);
      }
      return;
    }
    if (peer != null) {
      peer.sendRequestWithCallback(message, data, function (res) {});
      return;
    } else {
      this.app.network.sendRequestWithCallback(message, data, function (res) {});
      return;
    }
  }

  loadTransactions(obj = {}, mycallback, peer = null) {
    let storage_self = this;

    const message = "archive";
    let data: any = {};
    data.request = "load";
    data = Object.assign(data, obj);

    let internal_callback = (res) => {
      let txs = [];
      if (res) {
        for (let i = 0; i < res.length; i++) {
          let tx = new Transaction();
          tx.deserialize_from_web(this.app, res[i].tx);
          txs.push(tx);
        }
      }
      mycallback(txs);
    };

    if (peer === "localhost") {
      let archive_mod = this.app.modules.returnModule("Archive");
      if (archive_mod) {
        archive_mod.loadTransactionsWithCallback(obj, (res) => {
          internal_callback(res);
        });
      }
      return;
    }

    if (peer != null) {
      peer.sendRequestWithCallback(message, data, function (res) {
        internal_callback(res);
      });
      return;
    } else {
      this.app.network.sendRequestWithCallback(message, data, function (res) {
        internal_callback(res);
      });
      return;
    }
  }

  deleteTransactions(obj = {}, mycallback = null, peer = null) {
    const message = "archive";
    let data: any = {};
    data.request = "delete";
    data = Object.assign(data, obj);

    this.app.network.sendRequestWithCallback(message, data, function (obj) {
      mycallback();
    });
  }

  async resetOptions() {
    try {
      const response = await fetch(`/options`);
      this.app.options = await response.json();
      this.saveOptions();
    } catch (err) {
      console.error(err);
    }
  }

  saveOptions() {
    if (this.app.BROWSER == 1) {
      if (this.active_tab == 0) {
        return;
      }
    }
    try {
      if (typeof Storage !== "undefined") {
        localStorage.setItem("options", JSON.stringify(this.app.options));
      }
    } catch (err) {
      console.error(err);
    }
  }

  getOptions() {
    if (this.app.BROWSER == 1) {
      if (this.active_tab == 0) {
        return;
      }
    }
    try {
      if (typeof Storage !== "undefined") {
        return localStorage.getItem("options");
      }
    } catch (err) {
      console.error(err);
    }
  }

  getModuleOptionsByName(modname) {
    for (let i = 0; i < this.app.options.modules.length; i++) {
      if (this.app.options.modules[i].name === modname) {
        return this.app.options.modules[i];
      }
    }
    return null;
  }

  /**
   * DUMMY FUNCTIONS IMPLEMENTED BY STORAGE-CORE IN ./core/storage-core.js
   **/
  deleteBlockFromDisk(filename) {}

  async loadBlockById(bid): Promise<Block> {
    return null;
  }

  async loadBlockByHash(bsh): Promise<Block> {
    return null;
  }

  async loadBlockFromDisk(filename): Promise<Block> {
    return null;
  }

  async loadBlockByFilename(filename): Promise<Block> {
    return null;
  }

  async loadBlocksFromDisk(maxblocks = 0): Promise<Block> {
    return null;
  }

  returnPath() {
    return null;
  }

  returnFileSystem() {
    return null;
  }

  async saveBlock(block: Block): Promise<string> {
    return "";
  }

  saveClientOptions() {}

  async returnDatabaseByName(dbname) {
    return null;
  }

  async returnBlockFilenameByHash(block_hash, mycallback) {}

  returnTokenSupplySlipsFromDisk(): any {
    return [];
  }

  returnBlockFilenameByHashPromise(block_hash: string) {}

  async queryDatabase(sql, params, database) {}

  async insertDatabase(sql, params, database, mycallback = null) {}

  async executeDatabase(sql, params, database, mycallback = null) {}

  generateBlockFilename(block: Block): string {
    return ""; // empty
  }
}

export default Storage;
