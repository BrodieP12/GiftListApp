// test-endpoints.js - Run this with: node test-endpoints.js

// REPLACE this with your actual project ID from the emulator output
const PROJECT_ID = "giftlistapp-557ce";
const BASE_URL = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
console.log(BASE_URL);

async function postJSON(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    let data;
    try {
        data = await res.json();
    } catch {
        data = await res.text();
    }

    if (!res.ok) {
        throw { response: { data } };
    }
    return { data };
}

async function runTests() {
    console.log("🚀 Starting E-commerce AI Suite Tests...\n");

    // Test 1: Wishlist Manager
    console.log("🛒 Testing: Wishlist Manager");
    try {
        console.log(`${BASE_URL}/manageWishlist`);
        const wishlistRes = await postJSON(`${BASE_URL}/manageWishlist`, {
            budget: 600.00,
            owned_items: [
                { name: "Sony A7III Camera", category: "Electronics" }
            ],
            wishlist_items: [
                { name: "Sony 50mm f/1.8 Lens", price: 248.00, priority: "High" },
                { name: "Peak Design Camera Strap", price: 65.00, priority: "Medium" },
                { name: "Rode Wireless GO II", price: 299.00, priority: "Low" }
            ]
        });
        console.log("✅ Wishlist Result:\n", JSON.stringify(wishlistRes.data, null, 2), "\n");
    } catch (e) {
        console.error("❌ Wishlist Test Failed:", e.response?.data || e.message);
    }

    // Test 2: Price History Analyzer
    console.log("📉 Testing: Price Analyzer");
    try {
        const priceRes = await postJSON(`${BASE_URL}/analyzePrice`, {
            product: { name: "Apple AirPods Pro 2", brand: "Apple", price: 249.00 },
            history: [
                { date: "2023-11-24", price: 189.99 }, // Black Friday
                { date: "2023-12-25", price: 199.99 },
                { date: "2024-01-15", price: 249.00 },
                { date: "2024-02-01", price: 249.00 }
            ]
        });
        console.log("✅ Price Result:\n", JSON.stringify(priceRes.data, null, 2), "\n");
    } catch (e) {
        console.error("❌ Price Test Failed:", e.response?.data || e.message);
    }

    // Test 3: Product Comparison
    console.log("⚖️ Testing: Product Comparison");
    try {
        const compareRes = await postJSON(`${BASE_URL}/compareProducts`, {
            products: [
                { name: "Kindle Paperwhite", brand: "Amazon", price: 139.99, description: "6.8-inch display, waterproof, 8GB storage" },
                { name: "Kobo Paperwhite", brand: "Rakuten", price: 119.99, description: "7-inch display, waterproof, physical buttons" }
            ]
        });
        console.log("✅ Compare Result:\n", JSON.stringify(compareRes.data, null, 2), "\n");
    } catch (e) {
        console.error("❌ Compare Test Failed:", e.response?.data || e.message);
    }

    // Test 4: Web Product Extractor
    console.log("🌐 Testing: Web Product Extractor");
    try {
        const webRes = await postJSON(`${BASE_URL}/extractProduct`, {
            url: "https://www.amazon.com/Marsail-Ergonomic-Office-Chair-Adjustable/dp/B0CP22DQQS/ref=sr_1_5?crid=HEEUIH99APED&dib=eyJ2IjoiMSJ9.RP-mYj5F1CPqCvEi3T4_K04jWjQ4RNapC-m4zRm9tQclxpnjIvJLo-iEme3yzzY6XnBSgofP8rrx-lqU8oehwvtubBFHt8m2Psl_ISgR3S2St5_OSE9EuHwL5dureIW7hWXPxR3GWEMQ6oe1VhK4ElamW3TDShNdKqTM5SH-57dZ1r6NeqOqG3OSm7AWOzenne1pY3pKnFRygYgaq9tRoMzY-eC7rbkd80AaTRD1ycB9U4r0StmQD3UM_jkHni0Ahbqvk9toJYRqEDAB3K7aahRvTXNi18yNfGduaWxGnmM.n0I7P1p6KlMzhny_g1i505sanudTdDcAxNOIf7HhDto&dib_tag=se&keywords=Office+Chair&qid=1771608459&sprefix=office+chair%2Caps%2C175&sr=8-5" // Example Amazon Link
        });
        console.log("✅ Web Extractor Result:\n", JSON.stringify(webRes.data, null, 2), "\n");
    } catch (e) {
        console.error("❌ Web Extractor Test Failed:", e.response?.data || e.message);
    }
    
    console.log("🎉 All straightforward tests completed.");
    console.log("Note: Video Extractor and Receipt OCR skipped in automated batch due to file-size/processing times, but can be tested similarly!");
}

runTests();