import { Request, Response, NextFunction } from 'express';
import { negotiationService } from './negotiation.service.js';
import { offerGenerator } from './offer.generator.js';

export const startNegotiation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const negotiation = await negotiationService.createNegotiation(req.body);
    res.status(201).json({ message: 'Negotiation started', data: negotiation });
  } catch (error) {
    next(error);
  }
};

export const getNegotiationDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const negotiation = await negotiationService.getNegotiation(Number(req.params.id));
    res.status(200).json({ data: negotiation });
  } catch (error) {
    next(error);
  }
};

export const setPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const preferences = await negotiationService.savePreferences(req.body);
    res.status(200).json({ message: 'Preferences saved', data: preferences });
  } catch (error) {
    next(error);
  }
};

export const getAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    // Mock userId for now, should come from context
    const userId = req.context?.companyId || 1;

    // We need to fetch negotiation first to get RFQ ID.
    const negotiation = await negotiationService.getNegotiation(Number(id));
    if (!negotiation) {
      res.status(404).json({ error: 'Negotiation not found' });
      return;
    }
    const realBatna = await negotiationService.calculateBATNA(negotiation.rfqId as number, userId);

    const meso = await negotiationService.generateMESO(Number(id));

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

export const getNextMove = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { lastOffer } = req.body;
    const result = await offerGenerator.createOffer(Number(id), { lastOffer });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
