import Decimal from "decimal.js";

// Ensure Decimal has 2 decimal precision by default for currency arithmetic
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type DecimalValue = Decimal | string | number;

/**
 * Converts any decimal-like value into a Decimal instance.
 */
export function toDecimal(val: DecimalValue): Decimal {
  if (val instanceof Decimal) return val;
  return new Decimal(val || 0);
}

/**
 * Formats a monetary value in Indian Rupees (INR) with currency symbol.
 * Example: "₹1,25,450.00"
 */
export function formatINR(val: DecimalValue): string {
  const dec = toDecimal(val);
  const num = dec.toNumber();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a monetary value in Indian numbering without the currency symbol.
 * Example: "1,25,450.00"
 */
export function formatINRPlain(val: DecimalValue): string {
  const dec = toDecimal(val);
  const num = dec.toNumber();
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return TENS[ten] + (one ? "-" + ONES[one] : "");
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rem = n % 100;
  let str = "";
  if (hundred > 0) {
    str += ONES[hundred] + " Hundred";
    if (rem > 0) str += " and ";
  }
  if (rem > 0) {
    str += twoDigitsToWords(rem);
  }
  return str.trim();
}

/**
 * Converts numeric amount to Indian currency words.
 * Handles Crores, Lakhs, Thousands, Hundreds, and Paise.
 * Example: 154250.50 -> "One Lakh Fifty-Four Thousand Two Hundred Fifty Rupees and Fifty Paise Only"
 */
export function amountInWords(val: DecimalValue): string {
  const dec = toDecimal(val);
  if (dec.isZero()) return "Zero Rupees Only";

  const isNegative = dec.isNegative();
  const absDec = dec.abs();

  // Split into integer rupees and 2-digit paise
  const rupeesInt = absDec.floor();
  const paiseInt = absDec.minus(rupeesInt).times(100).round().toNumber();

  let rupeesNum = rupeesInt.toNumber();
  let words = "";

  if (rupeesNum === 0) {
    words = "";
  } else {
    const crore = Math.floor(rupeesNum / 10000000);
    rupeesNum %= 10000000;

    const lakh = Math.floor(rupeesNum / 100000);
    rupeesNum %= 100000;

    const thousand = Math.floor(rupeesNum / 1000);
    rupeesNum %= 1000;

    const remainder = rupeesNum;

    if (crore > 0) {
      words += (words ? " " : "") + threeDigitsToWords(crore) + " Crore";
    }
    if (lakh > 0) {
      words += (words ? " " : "") + twoDigitsToWords(lakh) + " Lakh";
    }
    if (thousand > 0) {
      words += (words ? " " : "") + twoDigitsToWords(thousand) + " Thousand";
    }
    if (remainder > 0) {
      words += (words ? " " : "") + threeDigitsToWords(remainder);
    }

    words = words.trim();
    words += words === "One" ? " Rupee" : " Rupees";
  }

  if (paiseInt > 0) {
    const paiseWords = twoDigitsToWords(paiseInt) + " Paise";
    if (words) {
      words += " and " + paiseWords;
    } else {
      words = paiseWords;
    }
  }

  words = (isNegative ? "Minus " : "") + words + " Only";
  return words.trim();
}
