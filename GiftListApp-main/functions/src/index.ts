import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

export { processReceipt } from "./receiptProcessor";
export { extractProduct } from "./productExtractor";
export { compareProducts } from "./productComparison";
export { analyzePrice, analyzePriceNoHistory } from "./priceAnalyzer";
export { manageWishlist } from "./wishlistManager";
export { extractProductFromVideo } from "./videoExtractor";
export { onListCreated } from "./onListCreated";
export { syncFeedbackToSheets } from "./syncFeedbackToSheets";
export { checkEmailInUse } from "./checkEmailInUse";