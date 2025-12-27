import models from "../models/index.js";
import logger from "../config/logger.js";
import { Op } from "sequelize";

/**
 * Context Service
 * Fetches relevant backend data to provide context to the LLM
 */
class ContextService {
  /**
   * Get cheapest offer from all negotiations for a requisition
   * @param {number} requisitionId - Requisition ID (rfqId field in Negotiation model)
   * @param {string} excludeNegotiationId - Negotiation ID to exclude (current negotiation)
   * @returns {Object|null} - Cheapest offer details or null
   */
  async getCheapestOffer(requisitionId, excludeNegotiationId = null) {
    try {
      const whereClause = {
          rfqId: requisitionId,
          status: "active",
        };
      
      if (excludeNegotiationId) {
        whereClause.id = { [Op.ne]: excludeNegotiationId };
      }

      const allNegotiations = await models.Negotiation.findAll({
        where: whereClause,
        include: [
          {
            model: models.NegotiationRound,
            as: "Rounds",
            order: [["createdAt", "DESC"]],
            limit: 1, // Get only the latest round
          },
          {
            model: models.User,
            as: "Vendor",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      let cheapestOffer = null;
      let cheapestPrice = Infinity;

      for (const neg of allNegotiations) {
        const lastRound = neg.Rounds?.[0];
        if (lastRound && lastRound.offerDetails) {
          const offerPrice = lastRound.offerDetails.price || lastRound.offerDetails.totalPrice;
          if (offerPrice && offerPrice < cheapestPrice) {
            cheapestPrice = offerPrice;
            cheapestOffer = {
              price: offerPrice,
              vendorName: neg.Vendor?.name || "Unknown Vendor",
              negotiationId: neg.id,
              roundNumber: lastRound.roundNumber,
              offerDetails: lastRound.offerDetails,
            };
          }
        }
      }

      return cheapestOffer;
    } catch (error) {
      logger.error("Error fetching cheapest offer:", error);
      return null;
    }
  }

  /**
   * Get negotiation context including rounds, requisition details, and vendor info
   */
  async getNegotiationContext(negotiationId) {
    try {
      const negotiation = await models.Negotiation.findByPk(negotiationId, {
        include: [
          {
            model: models.NegotiationRound,
            as: "Rounds",
            order: [["createdAt", "ASC"]],
          },
          {
            model: models.Requisition,
            as: "Requisition",
            include: [
              {
                model: models.RequisitionProduct,
                as: "RequisitionProduct",
                include: [
                  {
                    model: models.Product,
                    as: "Product",
                  },
                ],
              },
              {
                model: models.Project,
                as: "Project",
              },
            ],
          },
          {
            model: models.User,
            as: "Vendor",
            attributes: ["id", "name", "email"],
          },
        ],
      });

      if (!negotiation) {
        return null;
      }

      // Get cheapest offer from other vendors for leverage
      // negotiation.rfqId is the requisition ID (integer) stored in the rfqId field
      const cheapestOffer = await this.getCheapestOffer(negotiation.rfqId, negotiation.id);

      // Format the context for the LLM
      const context = {
        negotiation: {
          id: negotiation.id,
          status: negotiation.status,
          round: negotiation.round,
          score: negotiation.score,
        },
        requisition: {
          rfqId: negotiation.Requisition?.rfqId,
          subject: negotiation.Requisition?.subject,
          category: negotiation.Requisition?.category,
          status: negotiation.Requisition?.status,
          totalPrice: negotiation.Requisition?.totalPrice,
          finalPrice: negotiation.Requisition?.finalPrice,
          deliveryDate: negotiation.Requisition?.deliveryDate,
          negotiationClosureDate: negotiation.Requisition?.negotiationClosureDate,
          payment_terms: negotiation.Requisition?.payment_terms,
          net_payment_day: negotiation.Requisition?.net_payment_day,
          pre_payment_percentage: negotiation.Requisition?.pre_payment_percentage,
          post_payment_percentage: negotiation.Requisition?.post_payment_percentage,
          typeOfCurrency: negotiation.Requisition?.typeOfCurrency,
          batna: negotiation.Requisition?.batna,
          maxDiscount: negotiation.Requisition?.maxDiscount,
          discountedValue: negotiation.Requisition?.discountedValue,
          products: negotiation.Requisition?.RequisitionProduct?.map((rp) => ({
            productName: rp.Product?.name,
            productId: rp.Product?.id,
            quantity: rp.qty,
            targetPrice: rp.targetPrice,
            maximumPrice: rp.maximum_price,
            unitOfMeasure: rp.Product?.UOM,
          })) || [],
          project: negotiation.Requisition?.Project ? {
            projectName: negotiation.Requisition.Project.projectName,
            projectId: negotiation.Requisition.Project.projectId,
          } : null,
        },
        vendor: {
          name: negotiation.Vendor?.name,
          email: negotiation.Vendor?.email,
        },
        rounds: negotiation.Rounds?.map((round) => ({
          roundNumber: round.roundNumber,
          offerDetails: round.offerDetails,
          response: round.response,
          createdAt: round.createdAt,
        })),
        cheapestOffer, // Include cheapest offer from other vendors
      };

      return context;
    } catch (error) {
      logger.error("Error fetching negotiation context:", error);
      return null;
    }
  }

  /**
   * Get user preferences for negotiation
   */
  async getUserPreferences(userId, entityType = "Company") {
    try {
      const preferences = await models.Preference.findOne({
        where: {
          entityId: userId,
          entityType: entityType,
        },
      });

      return preferences ? preferences.toJSON() : null;
    } catch (error) {
      logger.error("Error fetching user preferences:", error);
      return null;
    }
  }

  /**
   * Get requisition context
   */
  async getRequisitionContext(requisitionId) {
    try {
      const requisition = await models.Requisition.findByPk(requisitionId, {
        include: [
          {
            model: models.RequisitionProduct,
            as: "RequisitionProduct",
            include: [
              {
                model: models.Product,
                as: "Product",
              },
            ],
          },
          {
            model: models.Project,
            as: "Project",
          },
          {
            model: models.Contract,
            as: "Contract",
            include: [
              {
                model: models.User,
                as: "Vendor",
                attributes: ["id", "name", "email"],
              },
            ],
          },
        ],
      });

      if (!requisition) {
        return null;
      }

      // Get cheapest offer from all negotiations for this requisition
      const cheapestOffer = await this.getCheapestOffer(requisitionId);

      return {
        rfqId: requisition.rfqId,
        subject: requisition.subject,
        category: requisition.category,
        status: requisition.status,
        totalPrice: requisition.totalPrice,
        finalPrice: requisition.finalPrice,
        deliveryDate: requisition.deliveryDate,
        negotiationClosureDate: requisition.negotiationClosureDate,
        payment_terms: requisition.payment_terms,
        net_payment_day: requisition.net_payment_day,
        pre_payment_percentage: requisition.pre_payment_percentage,
        post_payment_percentage: requisition.post_payment_percentage,
        typeOfCurrency: requisition.typeOfCurrency,
        batna: requisition.batna,
        maxDiscount: requisition.maxDiscount,
        discountedValue: requisition.discountedValue,
        products: requisition.RequisitionProduct?.map((rp) => ({
          productName: rp.Product?.name,
          productId: rp.Product?.id,
          quantity: rp.qty,
          targetPrice: rp.targetPrice,
          maximumPrice: rp.maximum_price,
          unitOfMeasure: rp.Product?.UOM,
        })) || [],
        contracts: requisition.Contract?.map((contract) => ({
          vendorName: contract.Vendor?.name,
          finalPrice: contract.finalPrice,
          status: contract.status,
        })) || [],
        cheapestOffer, // Include cheapest offer for context
        project: requisition.Project ? {
          projectName: requisition.Project.projectName,
          projectId: requisition.Project.projectId,
        } : null,
      };
    } catch (error) {
      logger.error("Error fetching requisition context:", error);
      return null;
    }
  }

  /**
   * Build context string for LLM prompt
   */
  buildContextString(context) {
    if (!context) {
      return "";
    }

    let contextStr = "\n\n=== CONTEXT ===\n";

    if (context.negotiation) {
      contextStr += `Negotiation Status: ${context.negotiation.status}\n`;
      contextStr += `Current Round: ${context.negotiation.round}\n`;
      contextStr += `Score: ${context.negotiation.score}\n`;
    }

    // Handle requisition context (can be nested under negotiation or direct)
    const requisition = context.requisition || context;
    if (requisition.rfqId || requisition.subject) {
      contextStr += `\n=== REQUISITION DETAILS ===\n`;
      contextStr += `RFQ ID: ${requisition.rfqId || "N/A"}\n`;
      contextStr += `Subject: ${requisition.subject || "N/A"}\n`;
      contextStr += `Category: ${requisition.category || "N/A"}\n`;
      contextStr += `Status: ${requisition.status || "N/A"}\n`;
      contextStr += `Currency: ${requisition.typeOfCurrency || "N/A"}\n`;
      contextStr += `\nPRICING INFORMATION:\n`;
      contextStr += `- Vendor's 1st Quotation: ${requisition.totalPrice || "Not set"} ${requisition.typeOfCurrency || ""}\n`;
      if (requisition.batna) {
        contextStr += `- Expected Price (BATNA): ${requisition.batna} ${requisition.typeOfCurrency || ""} [INTERNAL - DO NOT REVEAL]\n`;
      }
      if (requisition.discountedValue) {
        contextStr += `- Current Negotiated Price: ${requisition.discountedValue} ${requisition.typeOfCurrency || ""}\n`;
      }
      if (requisition.finalPrice) {
        contextStr += `- Final Price: ${requisition.finalPrice} ${requisition.typeOfCurrency || ""}\n`;
      }
      
      // Get maximum total price from preferences if available
      if (context.preferences?.constraints?.maxPrice) {
        contextStr += `- Maximum Total Price: ${context.preferences.constraints.maxPrice} ${requisition.typeOfCurrency || ""} [INTERNAL - DO NOT REVEAL]\n`;
      }
      
      // Delivery Information
      if (requisition.deliveryDate) {
        const deliveryDate = new Date(requisition.deliveryDate).toLocaleDateString();
        contextStr += `\nDelivery Requirements:\n`;
        contextStr += `- Required Delivery Date: ${deliveryDate}\n`;
        if (requisition.negotiationClosureDate) {
          const closureDate = new Date(requisition.negotiationClosureDate).toLocaleDateString();
          contextStr += `- Negotiation Closure Date: ${closureDate}\n`;
        }
      }
      
      // Payment Terms
      if (requisition.payment_terms) {
        contextStr += `\nPayment Terms:\n`;
        contextStr += `- Payment Terms: ${requisition.payment_terms}\n`;
        if (requisition.net_payment_day) {
          contextStr += `- Net Payment Days: ${requisition.net_payment_day}\n`;
        }
        if (requisition.pre_payment_percentage) {
          contextStr += `- Pre-payment: ${requisition.pre_payment_percentage}%\n`;
        }
        if (requisition.post_payment_percentage) {
          contextStr += `- Post-payment: ${requisition.post_payment_percentage}%\n`;
        }
      }
      
      // Products/Items Details
      if (requisition.products && requisition.products.length > 0) {
        contextStr += `\nItems Required:\n`;
        requisition.products.forEach((product, index) => {
          contextStr += `${index + 1}. ${product.productName || "N/A"}\n`;
          contextStr += `   - Quantity: ${product.quantity || "N/A"} ${product.unitOfMeasure || ""}\n`;
          contextStr += `   - Target Price: ${product.targetPrice || "N/A"} ${requisition.typeOfCurrency || ""}\n`;
          if (product.maximumPrice) {
            contextStr += `   - Maximum Acceptable Price: ${product.maximumPrice} ${requisition.typeOfCurrency || ""}\n`;
          }
        });
      } else {
        contextStr += `\nItems: No items specified yet\n`;
      }
      
      // Project Information
      if (requisition.project) {
        contextStr += `\nProject: ${requisition.project.projectName || requisition.project.projectId || "N/A"}\n`;
      }
      
      contextStr += `\n=== END REQUISITION DETAILS ===\n`;
      
      // Add negotiation guidance based on requisition details
      if (requisition.products && requisition.products.length > 0) {
        const totalQuantity = requisition.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        const highQuantityItems = requisition.products.filter(p => (p.quantity || 0) > 5);
        
        if (totalQuantity > 10) {
          contextStr += `\nNEGOTIATION LEVERAGE POINTS:\n`;
          contextStr += `- Total quantity ordered: ${totalQuantity} units - Use this for volume discount negotiation\n`;
          if (highQuantityItems.length > 0) {
            contextStr += `- High-quantity items: ${highQuantityItems.map(p => `${p.productName} (${p.quantity} units)`).join(", ")} - Focus on negotiating these items\n`;
          }
        }
        
        if (requisition.deliveryDate) {
          contextStr += `- Delivery date flexibility can be used to negotiate better pricing\n`;
        }
        
        if (requisition.payment_terms) {
          contextStr += `- Payment terms (${requisition.payment_terms}) can be negotiated for better pricing\n`;
        }
      }
    }

    if (context.vendor) {
      contextStr += `\nVendor: ${context.vendor.name} (${context.vendor.email})\n`;
    }

    if (context.rounds && context.rounds.length > 0) {
      contextStr += `\nNegotiation History:\n`;
      context.rounds.forEach((round) => {
        contextStr += `Round ${round.roundNumber}: ${JSON.stringify(round.offerDetails)}\n`;
        if (round.response) {
          contextStr += `Response: ${round.response}\n`;
        }
      });
    }

    // Include cheapest offer from other vendors (for leverage, but don't reveal exact price to user)
    if (context.cheapestOffer) {
      contextStr += `\n[INTERNAL - DO NOT REVEAL TO USER] Cheapest Offer from Other Vendors:\n`;
      contextStr += `- Another vendor has offered a competitive price (lower than current vendor's offer)\n`;
      contextStr += `- You can use this as leverage: "We have received more competitive offers from other vendors"\n`;
      contextStr += `- Do NOT reveal the exact price or vendor name to the user\n`;
      contextStr += `- Goal: Negotiate current vendor down to match or beat the cheapest offer\n`;
    }

    if (context.preferences) {
      // Include BATNA and max discount/price for internal decision making only
      if (context.preferences.constraints) {
        const constraints = context.preferences.constraints;
        if (constraints.batna || constraints.maxDiscount || constraints.maxPrice) {
          contextStr += `\n[INTERNAL NEGOTIATION PARAMETERS - NEVER REVEAL TO USER]:\n`;
          if (constraints.batna) {
            contextStr += `- BATNA (Best Alternative): ${constraints.batna} - This is your target price. Try to negotiate vendor to this value or lower.\n`;
          }
          if (constraints.maxDiscount) {
            contextStr += `- Maximum Acceptable Discount: ${constraints.maxDiscount}% - Aim for at least this discount.\n`;
          }
          if (constraints.maxPrice) {
            contextStr += `- Maximum Total Price: ${constraints.maxPrice} - Never accept offers above this.\n`;
          }
          contextStr += `\nIMPORTANT: These are INTERNAL parameters for your decision-making. DO NOT mention BATNA, maximum discount, or maximum price directly to the user.\n`;
          contextStr += `Your goal is to discuss the FIRST quotation with the user and negotiate the vendor down to the BATNA value without revealing it.\n`;
        }
      }
    }

    contextStr += "\n=== END CONTEXT ===\n";

    return contextStr;
  }
}

export default new ContextService();

