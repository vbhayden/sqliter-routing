const sqliter = require("../../sqliter/index");
const types = sqliter.types;

class TestModel extends sqliter.Model
{
    get id() { return "id" }
    get int() { return "int" }
    get test() { return "test" }
    get real() { return "real" }
    get date() { return "date" }

    constructor() {
        super()

        this.name = "test"
        this.define({
            id: {
                name: "id",
                type: types.AUTO_ID,
                description: "Auto-ID",
            },
            test: {
                name: "test",
                type: types.TEXT,
                default: "",
                description: "Sample text field.",
                required: true,
            }, 
            int: {
                name: "int",
                type: types.INTEGER,
                default: 0,
                description: "Sample int field.",
            },
            real: {
                name: "real",
                type: types.REAL,
                default: 3.14,
                description: "Sample float field.",
            },
            date: {
                name: "date",
                type: types.ISO_DATE,
                default: Date.now(),
                description: "Sample date field (stored as a number).",
            }
        })
    }
}

module.exports = TestModel