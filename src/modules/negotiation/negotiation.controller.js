import { negotiationService } from "./negotiation.service.js";
import { offerGenerator } from "./offer.generator.js";

export const startNegotiation = async (req, res, next) => {
    try {
        const negotiation = await negotiationService.createNegotiation(req.body);
        res.status(201).json({ message: "Negotiation started", data: negotiation });
    } catch (error) {
        next(error);
    }
};

export const getNegotiationDetails = async (req, res, next) => {
    try {
        const negotiation = await negotiationService.getNegotiation(req.params.id);
        res.status(200).json({ data: negotiation });
    } catch (error) {
        next(error);
    }
};

export const setPreferences = async (req, res, next) => {
    try {
        const preferences = await negotiationService.savePreferences(req.body);
        res.status(200).json({ message: "Preferences saved", data: preferences });
    } catch (error) {
        next(error);
    }
};

export const getAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Mock userId for now, should come from context
        const userId = req.context?.companyId || 1;

        const batna = await negotiationService.calculateBATNA(id, userId); // id here is negotiationId, but BATNA needs RFQ ID. 
        // We need to fetch negotiation first to get RFQ ID.
        const negotiation = await negotiationService.getNegotiation(id);
        const realBatna = await negotiationService.calculateBATNA(negotiation.rfqId, userId);

        const meso = await negotiationService.generateMESO(id);

        res.status(200).json({
            data: {
                batna: realBatna,
                meso: meso,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getNextMove = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { lastOffer } = req.body;
        const result = await offerGenerator.createOffer(id, { lastOffer });
        res.status(200).json({ data: result });
    } catch (error) {
        next(error);
    }
};
