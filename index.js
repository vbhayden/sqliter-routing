const express = require("express")
const sqliter = require("sqliter")

let model = new sqliter.Model()

function validQuery(model, payload, allowLimits = true, allowWhere = true) {
    let args = Object.keys(payload)
    for (let arg of args) {

        if (allowLimits && (arg == "limit" || arg == "offset" || arg == "order")) 
            continue
        else if (allowWhere && arg == "where")
            continue
        else if (model.props[arg] != undefined)
            continue
        else
            return false
    }
    return true
}

function invalidData(model, payload) {
    Object.keys(model.props).forEach(prop => {

        let modelProperty = model.props[prop]
        let payloadValue = payload[prop];

        let predefined = modelProperty.predefined;
        if (predefined != undefined && predefined.includes(payloadValue) == false)
            return {
                property: prop,
                received: payload,
                error: `Required property "${prop} was be one of the following: ${predefined.join(", ")}`
            };

        let required = modelProperty.required
        if (required && payloadValue == undefined)
            return {
                property: prop,
                received: payload,
                error: `Required property "${prop} was not included in request.`
            };

        let validType = modelProperty.type.class == "VIRTUAL" || modelProperty.type.typeCheck(payloadValue)
        if (!validType)
            return {
                property: prop,
                received: payload,
                error: `Given property ${prop} had an invalid type.`
            }
    });

    return false;
}

function parseWhereClauses(where) {
    if (where == undefined)
        return []
    
    return where.split(",").map(clause => {

        let double = clause.match(/(<=|>=|<>).*/g)
        if (double != undefined && double.length > 0) {
            let operator = double[0].substr(0, 2)
            let parts = clause.split(operator, 2)
            return `${parts[0]} ${operator} ${parts[1]}`
        }
        let single = clause.match(/(<|=|>).*/g)
        if (single != undefined && single.length > 0) {
            let operator = single[0].substr(0, 1)
            let parts = clause.split(operator, 2)
            return `${parts[0]} ${single[0].substr(0, 1)} ${parts[1]}`
        }
        else
            return null
    });
}

function getProps(model, payload) {
    let props = {}
    Object.keys(payload).forEach(prop => {
        if (model.props[prop] != undefined)
            props[prop] = payload[prop]
    })
    return props;
}

module.exports = {

    /**
     * Middleware to interpret the request as a creation operation.
     * 
     * @param {sqliter.Model} model Model to query.
     * @returns {Function<express.Request, express.Response, express.NextFunction} Express Middleware
     */
    create: (model) => {
        
        /**
         * @param {express.Request} req
         * @param {express.Response} res
         * @param {express.NextFunction} next
         */
        return async(req, res, next) => {
            
            if (!validQuery(model, req.body, false, false)) {
                res.status(400).send("Invalid Form Data, unknown arguments.");
                return;
            }

            let invalid = invalidData(model, req.body)
            if (invalid) {
                req.status(400).json(invalid)
            }
            
            let props = getProps(model, req.body)
            if (props.id !== undefined)
                delete props.id
            
            try {
                let results = await model.insert(props)
                res.json(results);
            }
            catch (error) {
                res.status(400).json(error)
            }
        }
    },

    /**
     * Middleware to process reading this model.
     * 
     * @param {sqliter.Model} model Model to query.
     * @returns {Function<express.Request, express.Response, express.NextFunction} Express Middleware
     */
    read: (model) => {
        
        /**
         * @param {express.Request} req
         * @param {express.Response} res
         * @param {express.NextFunction} next
         */
        return async(req, res, next) => {

            let payload = req.query;
            let explicitArgs = Object.keys(req.query).filter(arg => model.props[arg] != undefined)
            let explicitQuery = explicitArgs.map(arg => `${arg}=${req.query[arg]}`)

            let args = {
                where: [...parseWhereClauses(payload.where), ...explicitQuery],
                limit: payload.limit,
                order: payload.order,
                offset: payload.offset
            }

            try {
                let results = await model.select("*", args)
                res.json(results);
            }
            catch (error) {
                console.log(error)
                res.status(400).json(error)
            }
        }
    },

    /**
     * Middleware to process updating this model.
     * 
     * @param {sqliter.Model} model Model to query.
     * @returns {Function<express.Request, express.Response, express.NextFunction} Express Middleware
     */
    update: (model) => {
        
        /**
         * @param {express.Request} req
         * @param {express.Response} res
         * @param {express.NextFunction} next
         */
        return async(req, res, next) => {

            let payload = req.body;

            if (!validQuery(model, payload, false, true)) {
                res.status(400).send("Invalid Form Data, unknown arguments.");
                return;
            }

            let invalid = invalidData(model, payload)
            if (invalid) {
                req.status(400).json(invalid)
            }

            let props = getProps(model, payload)
            let args = {
                where: parseWhereClauses(payload.where),
                limit: payload.limit,
                order: payload.order,
                offset: payload.offset
            }

            if (props.id !== undefined)
                delete props.id

            try {
                let updated = await model.update(props, args)
                res.json(updated);
            }
            catch (error) {
                console.error(error);
                res.status(400).json(error)
            }
        }
    },

    /**
     * Middleware to enable deleting from model.
     * 
     * @param {sqliter.Model} model Model to query.
     * @returns {Function<express.Request, express.Response, express.NextFunction} Express Middleware
     */
    delete: (model) => {
        
        /**
         * @param {express.Request} req
         * @param {express.Response} res
         * @param {express.NextFunction} next
         */
        return async(req, res, next) => {

            let payload = req.body;

            if (!validQuery(model, payload, false, true)) {
                res.status(400).send("Invalid Form Data, unknown arguments.");
                return;
            }

            let args = {
                where: parseWhereClauses(payload.where),
                limit: payload.limit,
                order: payload.order,
                offset: payload.offset
            }

            if (args.where.length == 0) {
                res.status(400).send("Full table deletion not allowed, must specify 'where' clause(s).");
                return;
            }
            
            try {
                let results = await model.delete(args)
                res.json(results);
            }
            catch (error) {
                res.status(400).json(error)
            }
        }
    },
}