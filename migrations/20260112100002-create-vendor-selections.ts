import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('vendor_selections', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      requisition_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Requisitions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      comparison_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'bid_comparisons',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Reference to the comparison report that led to this selection',
      },
      selected_vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'The vendor who was selected',
      },
      selected_bid_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'vendor_bids',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'The specific bid that was selected',
      },
      selected_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'The final price of the selected bid',
      },
      selected_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'User who made the selection decision',
      },
      selection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional reason provided for the selection',
      },
      selection_method: {
        type: DataTypes.ENUM('EMAIL_LINK', 'PORTAL', 'API'),
        allowNull: false,
        comment: 'How the selection was made (email, portal, API)',
      },
      po_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Pos',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Auto-generated Purchase Order ID',
      },
      selected_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.literal('CURRENT_TIMESTAMP'),
        comment: 'When the selection was made',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('vendor_selections', ['requisition_id']);
    await queryInterface.addIndex('vendor_selections', ['selected_vendor_id']);
    await queryInterface.addIndex('vendor_selections', ['selected_by_user_id']);
    await queryInterface.addIndex('vendor_selections', ['selected_at']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('vendor_selections');
  },
};
