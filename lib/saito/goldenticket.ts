import {Saito} from "../../apps/core";

class GoldenTicket {
    public app: Saito;

    constructor(app: Saito) {
        this.app = app;
    }

    validate(previous_block_hash, random_hash, publickey, difficulty) {
        if (previous_block_hash === "") {
            previous_block_hash = "0000000000000000000000000000000000000000000000000000000000000000";
        }
        let buffer = Buffer.concat([this.app.binary.hexToSizedArray(previous_block_hash, 32),
            this.app.binary.hexToSizedArray(random_hash, 32),
            this.app.binary.hexToSizedArray(publickey, 33)
        ]);
        const solution = this.app.crypto.hash(buffer);
        const leading_zeroes_required = Math.floor(difficulty / 16);

        // create our target hash
        let target_hash = GoldenTicket.generateHash(difficulty);

        // anything lower than target hash acceptable
        for (let i = 0; i < leading_zeroes_required + 1 && i < 64; i++) {
            if (parseInt(solution[i], 16) > parseInt(target_hash[i], 16)) {
                return false;
            }
        }

        // if we hit here, true
        return true;
    }

    serialize(target_hash, random_hash) {
        const th = this.app.binary.hexToSizedArray(target_hash, 32);
        const rh = this.app.binary.hexToSizedArray(random_hash, 32);
        const cr = Buffer.from(this.app.crypto.fromBase58(this.app.wallet.returnPublicKey()), "hex");

        let result = Buffer.concat([th, rh, cr]);

        console.assert(result.length === 97, "golden ticket buffer wrong");
        return result;
    }

    deserialize(base64buf) {
        const buffer = Buffer.from(base64buf, "base64");

        return {
            target_hash: Buffer.from(buffer.slice(0, 32)).toString("hex"),
            random_hash: Buffer.from(buffer.slice(32, 64)).toString("hex"),
            creator: this.app.crypto.toBase58(Buffer.from(buffer.slice(64, 97)).toString("hex")),
        };
    }

    deserializeFromTransaction(transaction) {
        return this.deserialize(transaction.transaction.m);
    }

    public static generateHash(difficulty: number): string {
        const leading_zeroes_required = Math.floor(difficulty / 16);
        const final_digit = 16 >> (difficulty % 16);

        //
        // create our target hash
        //
        let target_hash = "";
        for (let i = 0; i < 64; i++) {
            if (i < leading_zeroes_required) {
                target_hash += "0";
            } else {
                if (i === leading_zeroes_required && final_digit > 0 && final_digit < 16) {
                    target_hash += final_digit.toString(16);
                } else {
                    target_hash += "F";
                }
            }
        }

        return target_hash;
    }
}

export default GoldenTicket;
