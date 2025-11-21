import PDFDocument from "pdfkit";
import fs from "fs";

const OUTPUT_PATH = "pdf/po.pdf";
const BLACK_RECT_TEXT_TOP_MARGIN = 156;

const divideStringAtClosestComma = (input = "") => {
  if (!input) {
    return { part1: "", part2: "" };
  }
  const middleIndex = Math.floor(input.length / 2);
  const leftComma = input.lastIndexOf(",", middleIndex);
  const rightComma = input.indexOf(",", middleIndex);
  let index;
  if (leftComma === -1) {
    index = rightComma;
  } else if (rightComma === -1) {
    index = leftComma;
  } else {
    index = middleIndex - leftComma <= rightComma - middleIndex ? leftComma : rightComma;
  }
  if (index === -1) {
    return { part1: input, part2: "" };
  }
  return {
    part1: `${input.substring(0, index).trim()},`,
    part2: input.substring(index + 1).trim(),
  };
};

const formatCurrency = (amount) => {
  const value = Number.parseFloat(amount);
  if (Number.isNaN(value)) {
    return "0.00";
  }
  const [whole, fraction] = value.toFixed(2).split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withCommas}.${fraction}`;
};

const formatDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const createHeader = (doc, po) => {
  const startX = doc.x;
  const startY = doc.y;
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("PURCHASE ORDER", startX + 30, startY + 30, {
      align: "left",
      continued: true,
    });

  const vendorCompany = po.Vendor?.Company ?? {};
  const addressInParts = divideStringAtClosestComma(vendorCompany.fullAddress);

  doc
    .fontSize(10)
    .text(vendorCompany.companyName ?? "", 30, 30, {
      align: "right",
    })
    .font("Helvetica")
    .text(addressInParts.part1, 30, 45, { align: "right" })
    .text(addressInParts.part2, 30, 60, { align: "right" })
    .text(`Phone: ${vendorCompany.pocPhone ?? ""}`, 30, 75, { align: "right" })
    .text(`Email: ${vendorCompany.pocEmail ?? ""}`, 30, 90, { align: "right" });
};

const createBusinessInfo = (doc, po) => {
  doc.rect(30, 150, 550, 20).fill("#000").stroke();

  doc
    .fill("#FFF")
    .text("VENDOR", 35, BLACK_RECT_TEXT_TOP_MARGIN)
    .text("SHIP TO", 215, BLACK_RECT_TEXT_TOP_MARGIN)
    .text("P.O NUMBER", 415, BLACK_RECT_TEXT_TOP_MARGIN);

  const vendorAddress = divideStringAtClosestComma(po.Vendor?.Company?.fullAddress);
  const companyAddress = divideStringAtClosestComma(po.Company?.fullAddress);

  const vendorTop = 178;
  let left = 35;

  doc
    .fill("#000")
    .fontSize(10)
    .text(po.Vendor?.name ?? "", left, vendorTop)
    .font("Helvetica-Bold")
    .text(po.Vendor?.Company?.companyName ?? "", left, vendorTop + 15)
    .font("Helvetica")
    .text(vendorAddress.part1, left, vendorTop + 30)
    .text(vendorAddress.part2, left, vendorTop + 45)
    .text(`Phone: ${po.Vendor?.Company?.pocPhone ?? ""}`, left, vendorTop + 60)
    .text(`Email: ${po.Vendor?.Company?.pocEmail ?? ""}`, left, vendorTop + 75);

  left = 215;
  doc
    .fill("#000")
    .fontSize(10)
    .text(po.Company?.pocName ?? "", left, vendorTop)
    .font("Helvetica-Bold")
    .text(po.Company?.companyName ?? "", left, vendorTop + 15)
    .font("Helvetica")
    .text(companyAddress.part1, left, vendorTop + 30)
    .text(companyAddress.part2, left, vendorTop + 45)
    .text(`Phone: ${po.Company?.pocPhone ?? ""}`, left, vendorTop + 60)
    .text(`Email: ${po.Company?.pocEmail ?? ""}`, left, vendorTop + 75);

  left = 415;
  doc
    .fill("#000")
    .fontSize(10)
    .text("PO No. : ", left, vendorTop)
    .text(po.poNumber ?? "", left + 50, vendorTop)
    .text("Date :", left, vendorTop + 15)
    .text(formatDate(po.createdAt), left + 50, vendorTop + 15);
};

const createProductInfo = (doc, lineItems, products, currencySymbol) => {
  const tableMargin = BLACK_RECT_TEXT_TOP_MARGIN + 150;

  doc.rect(30, tableMargin, 550, 20).fill("#000").stroke();
  doc
    .fill("#FFF")
    .text("S. No.", 35, tableMargin + 5)
    .text("Product", 75, tableMargin + 5)
    .text("Qty", 260, tableMargin + 5)
    .text("Price", 330, tableMargin + 5)
    .text("Tax", 410, tableMargin + 5)
    .text("Total", 500, tableMargin + 5);
  doc.fill("#000");

  let y = tableMargin + 20;
  let subTotal = 0;
  let tax = 0;

  lineItems.forEach((item, index) => {
    doc.rect(30.5, y, 549.5, 20).stroke();
    const product = products[index] || {};
    const taxPercentage = product.gstType === "GST" ? product.gstPercentage : 0;
    const itemSubtotal = item.qty * item.price;
    const itemTax = (itemSubtotal * taxPercentage) / 100;

    subTotal += itemSubtotal;
    tax += itemTax;

    doc.text(index + 1, 35, y + 5);
    doc.text(product.productName ?? "", 75, y + 5);
    doc.text(item.qty ?? "", 260, y + 5);
    doc.text(`${currencySymbol}${formatCurrency(item.price)}`, 330, y + 5);
    doc.text(`${currencySymbol}${formatCurrency(itemTax)}`, 410, y + 5);
    doc.text(`${currencySymbol}${formatCurrency(itemSubtotal)}`, 500, y + 5);

    y += 20;
  });

  return { subTotal, tax, total: subTotal + tax, y };
};

const createPoTotal = (doc, subTotal, tax, total, y) => {
  const width = doc.page.width;
  doc
    .text("Sub Total", 400, y + 20)
    .text(`$${formatCurrency(subTotal)}`, width - 90, y + 20, { align: "right" })
    .text("Tax", 400, y + 40)
    .text(`$${formatCurrency(tax)}`, width - 90, y + 40, { align: "right" })
    .text("Total", 400, y + 60)
    .text(`$${formatCurrency(total)}`, 0, y + 60, { align: "right" });
};

const createFooter = (doc, po, y) => {
  doc.text(po.paymentTerms ?? "", 0, y + 150, { align: "center" });
};

export const createPo = async (po, lineItems, products) => {
  const currencySymbol = "$";
  const doc = new PDFDocument({
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 30,
    },
  });

  await fs.promises.mkdir("pdf", { recursive: true });

  const writeStream = fs.createWriteStream(OUTPUT_PATH);
  doc.pipe(writeStream);

  createHeader(doc, po);
  createBusinessInfo(doc, po);
  const { subTotal, tax, total, y } = createProductInfo(doc, lineItems, products, currencySymbol);
  createPoTotal(doc, subTotal, tax, total, y);
  createFooter(doc, po, y);

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return fs.promises.readFile(OUTPUT_PATH);
};
