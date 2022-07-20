const express = require("express");
const bodyParser = require("body-parser");

const uuidV4 = require("uuid/v4")
const chai = require("chai");
const chaiHttp = require("chai-http")
const axios = require("axios").default
const sqlite = require("better-sqlite3");

const expect = chai.expect;

const routes = require("../index")
const TestModel = require("./model")

chai.use(chaiHttp);

describe("CRUD Operations", () => {

    let app;
    let server;
    let db;
    let model;
    let root = "http://localhost:3000"
    let URL_READ = root + "/read"
    let URL_CREATE = root + "/create"
    let URL_UPDATE = root + "/update"
    let URL_DELETE = root + "/delete"

    before(async() => {
        
        db = sqlite(__dirname + "/test.db", {
            fileMustExist: false,
            readonly: false
        });

        model = new TestModel();
        await model.init(db);

        app = express();
        app.use(bodyParser.json())
        app.get("/read", routes.read(model))
        app.post("/create", routes.create(model))
        app.post("/update", routes.update(model))
        app.post("/delete", routes.delete(model))
        server = app.listen(3000)
    })

    after(() => {
        server.close();
    })

    it("Should allow CREATE", async() => {
        
        let beforeResponse = await axios.get(URL_READ)
        let beforeCount = beforeResponse.data.length

        await axios.post(URL_CREATE, {int: 1325, test: "HELLO GUYS", real: 2.717})
        let afterCount = await (await axios.get(URL_READ)).data.length

        expect(afterCount).to.eql(beforeCount + 1)
    })

    it("should allow READ", async() => {

        let response = await axios.get(URL_READ)
        expect(response.data).to.be.a("array")
        expect(model.verify(response.data[0]))
    })

    it("Should handle the WHERE syntax", async() => {
        let response = await axios.get(URL_READ + "?where=id<=10,real>2,test='hey man ..',date<>123456")
        expect(response.data).to.be.a("array")
    })

    it("Should handle ORDER and LIMIT properly", async() => {

        let random = Math.random()
        await axios.post(URL_CREATE, {int: 9999, test: "UPDATE ME", real: random})
        await axios.post(URL_CREATE, {int: 10000, test: "UPDATE ME", real: random})

        let response = await axios.get(URL_READ + `?real=${random}&order=id desc&limit=2`)

        expect(response.data[0].int).to.equal(10000)
        expect(response.data[1].int).to.equal(9999)
        expect(response.data.length).to.equal(2)
    });

    it("Should allow UPDATE", async() => {
        
        // Create a new entry
        await axios.post(URL_CREATE, {int: 1325, test: "UPDATE ME", real: 2.717})
        
        // Get whatever we just made and change its field
        let newData = await axios.get(URL_READ + "?order=id desc&limit=1")
        newData.data[0].test = "OK I DID"
        
        // Submit that update with our endpoint
        await axios.post(URL_UPDATE, {...newData.data[0], where: "id=" + newData.data[0].id })
        
        // Get the version of that as it exists in SQLite
        let updatedData = await axios.get(URL_READ + "?order=id desc&limit=1")
        
        // Check that these are the same
        expect(updatedData.data[0].test).to.eql("OK I DID")
    })

    it("Should fail UPDATE when bad Date given", async() => {
        
        // Create a new entry
        await axios.post(URL_CREATE, {int: 1325, test: "DATE CHECK", real: 2.717, date: new Date()})
        
        // Get whatever we just made and change its field
        let newData = await axios.get(URL_READ + "?order=id desc&limit=1")
        newData.data[0].date = "NOT A GOOD DATE, MAN"
        
        // Submit that update with our endpoint
        try {
            let response = await axios.post(URL_UPDATE, {...newData.data[0], where: "id=" + newData.data[0].id })
            if (response.status < 400)
                throw Error("Not Rejected")
        }
        catch(error) {
            if (!(error.isAxiosError || error instanceof TypeError))
                throw Error("Not Rejected");
        }
    })

    it("Should allow DELETE", async() => {
        
        // Create a new entry
        await axios.post(URL_CREATE, {int: 1325, test: "DELETE ME", real: 2.717})
        
        // Get whatever we just made and change its field
        let createRes = await axios.get(URL_READ + "?order=id desc&limit=1")
        let createId = createRes.data[0].id
        
        // Submit that update with our endpoint
        await axios.post(URL_DELETE, {where: `id=${createId}`})
        
        // Get the version of that as it exists in SQLite
        let checkRes = await axios.get(URL_READ + `?order=id desc&limit=1&where=id=${createId}`)

        // Check that these are the same
        expect(checkRes.data.length).to.eql(0)
    })

    it ("Should allow explicit query arguments [Real]", async() => {
        
        let random = Math.random()

        await axios.post(URL_DELETE, {where: `real=${random}`})

        // Create a new entry
        let insertRes = await axios.post(URL_CREATE, {real: random})
        let selectRes = await axios.get(URL_READ + `?real=${random}`)

        expect(selectRes.data.length).to.equal(1);
        expect(selectRes.data[0].real).to.equal(random);
    });

    it ("Should allow explicit query arguments [UUID]", async() => {
        
        let uuid = uuidV4()

        let createRes = await axios.post(URL_CREATE, {int: 1325, test: uuid, real: 2.717, date: new Date()})
        console.log("CREATE:", createRes.data)

        // Create a new entry
        let selectRes = await axios.get(URL_READ + `?test=${uuid}&order=id desc&limit=1`)

        expect(selectRes.data.length).to.equal(1);
        expect(selectRes.data[0].test).to.equal(uuid);
    });
});