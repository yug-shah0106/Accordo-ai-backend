import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("Pos", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      contractId: {
        type: DataTypes.INTEGER,
      },
      requisitionId: {
        type: DataTypes.INTEGER,
      },
      companyId: {
        type: DataTypes.INTEGER,
      },
      vendorId: {
        type: DataTypes.INTEGER,
      },
      lineItems: {
        type: DataTypes.STRING,
      },
      subTotal: {
        type: DataTypes.DOUBLE,
      },
      taxTotal: {
        type: DataTypes.DOUBLE,
      },
      total: {
        type: DataTypes.DOUBLE,
      },
      status: {
        type: DataTypes.ENUM("Created", "Cancelled"),
      },
      poNumber: {
        type: DataTypes.STRING,
      },
      poUrl: {
        type: DataTypes.STRING,
      },
      deliveryDate: {
        type: DataTypes.DATE,
      },
      paymentTerms: {
        type: DataTypes.STRING,
      },
      addedBy: {
        type: DataTypes.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("Pos");
  },
};
