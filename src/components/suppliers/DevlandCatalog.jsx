import { useState } from "react";
import { ShoppingCart, Check, X, Search, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";

const CATALOG = [
  // Maize & Flour
  { name: "Snow White Maize Meal 5kg", category: "Food & Groceries", cost_price: 30.99, unit: "each" },
  { name: "Snow White Maize Meal 10kg", category: "Food & Groceries", cost_price: 59.99, unit: "each" },
  { name: "Snow White Maize Meal 12.5kg", category: "Food & Groceries", cost_price: 69.99, unit: "each" },
  { name: "White Star Maize Meal 10kg", category: "Food & Groceries", cost_price: 48.49, unit: "each" },
  { name: "White Star Maize Meal 12.5kg", category: "Food & Groceries", cost_price: 88.99, unit: "each" },
  { name: "Super White Maize Meal 10kg", category: "Food & Groceries", cost_price: 35.99, unit: "each" },
  { name: "Super White Maize Meal 12.5kg", category: "Food & Groceries", cost_price: 68.99, unit: "each" },
  { name: "Itau Maize Meal 5kg", category: "Food & Groceries", cost_price: 32.99, unit: "each" },
  { name: "Itau Maize Meal 12.5kg", category: "Food & Groceries", cost_price: 79.99, unit: "each" },
  { name: "Ace Maize Meal 100x1kg", category: "Food & Groceries", cost_price: 97.99, unit: "box" },
  { name: "Ace Maize Meal 8x2.5kg", category: "Food & Groceries", cost_price: 188.99, unit: "box" },
  { name: "Ace Maize Meal 5kg", category: "Food & Groceries", cost_price: 41.99, unit: "each" },
  { name: "Ace Maize Meal 12.5kg", category: "Food & Groceries", cost_price: 96.99, unit: "each" },
  { name: "Iwisa Maize Meal 100x1kg", category: "Food & Groceries", cost_price: 98.99, unit: "box" },
  { name: "Iwisa Maize Meal 8x2.5kg", category: "Food & Groceries", cost_price: 188.99, unit: "box" },
  { name: "Iwisa Maize Meal 5kg", category: "Food & Groceries", cost_price: 47.99, unit: "each" },
  { name: "Iwisa Maize Meal 10kg", category: "Food & Groceries", cost_price: 77.99, unit: "each" },
  { name: "Iwisa Maize Meal 12.5kg", category: "Food & Groceries", cost_price: 97.99, unit: "each" },
  { name: "Papa Maize Meal 5kg", category: "Food & Groceries", cost_price: 33.99, unit: "each" },
  { name: "Papa Maize Meal 10kg", category: "Food & Groceries", cost_price: 62.99, unit: "each" },
  { name: "Papa Maize Meal 12.5kg", category: "Food & Groceries", cost_price: 72.99, unit: "each" },
  { name: "SnowFlake Cake Flour 8x2.5kg", category: "Food & Groceries", cost_price: 258.99, unit: "box" },
  { name: "SnowFlake Cake Flour 4x5kg", category: "Food & Groceries", cost_price: 258.99, unit: "box" },
  { name: "Sako Cake Flour 12.5kg", category: "Food & Groceries", cost_price: 127.99, unit: "each" },
  { name: "Sako Cake Flour 45kg", category: "Food & Groceries", cost_price: 225.99, unit: "each" },
  { name: "Excella Cooking Oil 12x500ml", category: "Food & Groceries", cost_price: 187.99, unit: "box" },
  { name: "Excella Cooking Oil 12x750ml", category: "Food & Groceries", cost_price: 234.99, unit: "box" },
  { name: "Excella Cooking Oil 2lt", category: "Food & Groceries", cost_price: 65.99, unit: "each" },
  { name: "Excella Cooking Oil 5lt", category: "Food & Groceries", cost_price: 165.99, unit: "each" },
  // Rice & Pasta
  { name: "Induna Maize Meal 12.5kg", category: "Food & Groceries", cost_price: 59.99, unit: "each" },
  { name: "Golden Delight Rice 10kg", category: "Food & Groceries", cost_price: 109.99, unit: "each" },
  { name: "Golden Basmati Rice 5kg", category: "Food & Groceries", cost_price: 114.99, unit: "each" },
  { name: "Tastic Rice 10kg", category: "Food & Groceries", cost_price: 128.99, unit: "each" },
  { name: "Ashoka Basmati Rice 5kg", category: "Food & Groceries", cost_price: 113.99, unit: "each" },
  { name: "Bakers Dream Cake Flour 12.5kg", category: "Food & Groceries", cost_price: 123.99, unit: "each" },
  { name: "King Korn Malt 15x1kg", category: "Food & Groceries", cost_price: 279.99, unit: "box" },
  { name: "Sunbest Pasta Asst 20x500g", category: "Food & Groceries", cost_price: 144.99, unit: "box" },
  { name: "Massimo Macaroni 20x500g", category: "Food & Groceries", cost_price: 229.99, unit: "box" },
  { name: "Fatti's & Moni's Spaghetti 20x500g", category: "Food & Groceries", cost_price: 274.99, unit: "box" },
  // Sauces & Condiments
  { name: "All Gold Tomato Sauce 6x350ml", category: "Food & Groceries", cost_price: 123.99, unit: "box" },
  { name: "Botselo Sugar Beans 6x500ml", category: "Food & Groceries", cost_price: 119.99, unit: "box" },
  { name: "Mama's Mayonnaise 6x750ml", category: "Food & Groceries", cost_price: 188.99, unit: "box" },
  { name: "Crosse & Blackwell Mayonnaise 6x375ml", category: "Food & Groceries", cost_price: 224.99, unit: "box" },
  { name: "Steers Sauce Asst 6x72x400g", category: "Food & Groceries", cost_price: 199.99, unit: "box" },
  { name: "Koo Baked Beans 6x72x415g", category: "Food & Groceries", cost_price: 59.99, unit: "box" },
  { name: "Koo Baked Beans 12x410g", category: "Food & Groceries", cost_price: 164.99, unit: "box" },
  { name: "Koo Garden Peas 12x410g", category: "Food & Groceries", cost_price: 49.99, unit: "box" },
  { name: "Aunt Sally's Baked Beans 6x300g", category: "Food & Groceries", cost_price: 85.99, unit: "box" },
  { name: "Soyfola Cooking Oil 12x750ml", category: "Food & Groceries", cost_price: 669.99, unit: "box" },
  { name: "Bull Brand Corned Meat 6x300g", category: "Food & Groceries", cost_price: 136.99, unit: "box" },
  // Stock Cubes & Soups
  { name: "Glenryck Pilchards 12x400g", category: "Food & Groceries", cost_price: 259.99, unit: "box" },
  { name: "Knorrox Stock Cubes 6x350ml", category: "Food & Groceries", cost_price: 214.99, unit: "box" },
  { name: "Robertson's Envelope Slices 20x5g", category: "Food & Groceries", cost_price: 53.50, unit: "box" },
  { name: "Knorr Soup 10s", category: "Food & Groceries", cost_price: 41.99, unit: "box" },
  { name: "Royco Soup 10s", category: "Food & Groceries", cost_price: 41.99, unit: "box" },
  { name: "Benny Stock Powder 42s", category: "Food & Groceries", cost_price: 40.99, unit: "box" },
  { name: "Eggs 15 Dozen", category: "Food & Groceries", cost_price: 295.99, unit: "box" },
  { name: "Rainbow IQF Chicken", category: "Food & Groceries", cost_price: 74.99, unit: "each" },
  { name: "Rainbow Isikheba 6x700g", category: "Food & Groceries", cost_price: 239.99, unit: "box" },
  { name: "Royal Baking Powder 12x100g", category: "Food & Groceries", cost_price: 212.99, unit: "box" },
  // Cereals & Hot Drinks
  { name: "Power Instant Yeast 48x10g", category: "Food & Groceries", cost_price: 78.99, unit: "box" },
  { name: "Ultra Mel Instant Yeast 10lt", category: "Food & Groceries", cost_price: 198.99, unit: "each" },
  { name: "Parmalat Custard 54s (900g)", category: "Food & Groceries", cost_price: 93.99, unit: "box" },
  { name: "Bonita Long Life UHT Milk 10x500ml/6x1lt", category: "Dairy", cost_price: 94.99, unit: "box" },
  { name: "Cremora 20x75g", category: "Food & Groceries", cost_price: 949.99, unit: "box" },
  { name: "Ricoffy Coffee 750g/Refill 800g", category: "Food & Groceries", cost_price: 126.99, unit: "each" },
  { name: "Ricoffy Coffee 6x250g", category: "Food & Groceries", cost_price: 314.99, unit: "box" },
  { name: "Five Roses Teabags 20x10s", category: "Food & Groceries", cost_price: 123.99, unit: "box" },
  { name: "Bokomo Weet-Bix 450g", category: "Food & Groceries", cost_price: 24.99, unit: "each" },
  { name: "Bokomo Corn Flakes 1kg", category: "Food & Groceries", cost_price: 48.99, unit: "each" },
  { name: "7am Corn Flakes 12x1kg", category: "Food & Groceries", cost_price: 349.99, unit: "box" },
  { name: "White Star Instant Porridge 10x1kg", category: "Food & Groceries", cost_price: 174.99, unit: "box" },
  { name: "Ace Instant Porridge 10x1kg", category: "Food & Groceries", cost_price: 149.99, unit: "box" },
  { name: "Norvite Instant Porridge 10x500ml", category: "Food & Groceries", cost_price: 239.99, unit: "box" },
  // Jam & Peanut Butter
  { name: "Hugo's Jam Asst 6x900g", category: "Food & Groceries", cost_price: 174.99, unit: "box" },
  { name: "All Gold Jam Asst 6x900g", category: "Food & Groceries", cost_price: 170.99, unit: "box" },
  { name: "Black Cat Peanut Butter 6x400g", category: "Food & Groceries", cost_price: 148.49, unit: "box" },
  { name: "Black Cat Peanut Butter 6x800g", category: "Food & Groceries", cost_price: 199.99, unit: "box" },
  // Drinks
  { name: "Coca-Cola Soft Drink 24x900ml", category: "Drinks & Beverages", cost_price: 130.99, unit: "box" },
  { name: "Coca-Cola/Fanta Stoney Glass 12x1.25lt", category: "Drinks & Beverages", cost_price: 126.99, unit: "box" },
  { name: "Coca-Cola/Fanta PET 24x400ml", category: "Drinks & Beverages", cost_price: 179.99, unit: "box" },
  { name: "Coca-Cola/Fanta/Sprite/Stoney Cans 28x250ml", category: "Drinks & Beverages", cost_price: 226.99, unit: "box" },
  { name: "Coca-Cola/Fanta/Sprite/Schweppes 185x1.5lt", category: "Drinks & Beverages", cost_price: 185.99, unit: "box" },
  { name: "Coca-Cola/Fanta/Sprite/Stoney Glass 28x250ml", category: "Drinks & Beverages", cost_price: 129.99, unit: "box" },
  { name: "Thirsti Flav. Water 6x1.5lt", category: "Drinks & Beverages", cost_price: 36.99, unit: "box" },
  { name: "Kingsley Soft Drink 12x1.5lt", category: "Drinks & Beverages", cost_price: 66.99, unit: "box" },
  { name: "Pepsi Soft Drink 24x330ml", category: "Drinks & Beverages", cost_price: 71.99, unit: "box" },
  { name: "Aquelle Water 6x1.5lt", category: "Drinks & Beverages", cost_price: 38.99, unit: "box" },
  { name: "Aquelle Water 6x800ml", category: "Drinks & Beverages", cost_price: 79.99, unit: "box" },
  { name: "Aquelle Water 6x800ml Large", category: "Drinks & Beverages", cost_price: 398.99, unit: "box" },
  { name: "Refreshh Energy Drink 6x2lt", category: "Drinks & Beverages", cost_price: 36.99, unit: "box" },
  { name: "Blast Energy Drink 12x300ml", category: "Drinks & Beverages", cost_price: 319.99, unit: "box" },
  { name: "Monster Energy Drink 24x500ml", category: "Drinks & Beverages", cost_price: 183.99, unit: "box" },
  { name: "Score Energy Drink 24x500ml", category: "Drinks & Beverages", cost_price: 183.99, unit: "box" },
  { name: "Dragon Energy Drink 24x500ml", category: "Drinks & Beverages", cost_price: 159.99, unit: "box" },
  { name: "Fruticana Smooty 12x500ml", category: "Drinks & Beverages", cost_price: 81.99, unit: "box" },
  { name: "Sbo Concentrate 4x200ml", category: "Drinks & Beverages", cost_price: 61.99, unit: "box" },
  { name: "Tropika Fresh Juice 2lt", category: "Drinks & Beverages", cost_price: 31.99, unit: "each" },
  { name: "Clover Krush 1.5lt", category: "Drinks & Beverages", cost_price: 39.99, unit: "each" },
  { name: "Krush/Tropika Asst 6x1lt", category: "Drinks & Beverages", cost_price: 119.99, unit: "box" },
  { name: "Krush/Tropika Cans 6x300ml", category: "Drinks & Beverages", cost_price: 47.99, unit: "box" },
  // Snacks & Sweets
  { name: "Halls Lozenges 72s", category: "Snacks & Sweets", cost_price: 15.99, unit: "box" },
  { name: "Bubble Gum Rolly Sour 20s", category: "Snacks & Sweets", cost_price: 15.99, unit: "box" },
  { name: "Pin Pop/Yoqueta Lollipop 48s", category: "Snacks & Sweets", cost_price: 37.99, unit: "box" },
  { name: "Nestle Mini's 24s", category: "Snacks & Sweets", cost_price: 88.99, unit: "box" },
  { name: "Chappies 100s", category: "Snacks & Sweets", cost_price: 33.75, unit: "box" },
  { name: "Nut Crisp Coated Candy 50s", category: "Snacks & Sweets", cost_price: 35.99, unit: "box" },
  { name: "Nik Naks Baler 12x100g", category: "Snacks & Sweets", cost_price: 49.50, unit: "box" },
  { name: "Nik Naks Baler 50x20g", category: "Snacks & Sweets", cost_price: 42.99, unit: "box" },
  { name: "Doritos Chips 20x145g", category: "Snacks & Sweets", cost_price: 359.99, unit: "box" },
  { name: "Simba Chips 30x36g", category: "Snacks & Sweets", cost_price: 335.99, unit: "box" },
  { name: "Simba Chips 20x120g", category: "Snacks & Sweets", cost_price: 349.99, unit: "box" },
  { name: "Pringles 19x165g", category: "Snacks & Sweets", cost_price: 797.99, unit: "box" },
  { name: "Lays Chips 20x120g", category: "Snacks & Sweets", cost_price: 359.99, unit: "box" },
  { name: "Baby Nax 50x16g", category: "Snacks & Sweets", cost_price: 27.99, unit: "box" },
  { name: "Oozies Baler 50x14g", category: "Snacks & Sweets", cost_price: 36.99, unit: "box" },
  { name: "Frimax Snappers 50x22g", category: "Snacks & Sweets", cost_price: 45.99, unit: "box" },
  { name: "Mzanzi Snacks 50x20g", category: "Snacks & Sweets", cost_price: 33.99, unit: "box" },
  { name: "Sniggles Baler 60x16g", category: "Snacks & Sweets", cost_price: 49.99, unit: "box" },
  { name: "Krunch Chips 20x125g", category: "Snacks & Sweets", cost_price: 249.99, unit: "box" },
  // Household
  { name: "Sunlight Dish Liquid 6x400ml", category: "Household", cost_price: 97.99, unit: "box" },
  { name: "Jik Bleach Asst 6x500ml", category: "Household", cost_price: 63.99, unit: "box" },
  { name: "Domestos Thick Bleach 750ml", category: "Household", cost_price: 44.99, unit: "each" },
  { name: "Doom Mosquito Coils 125g", category: "Household", cost_price: 45.99, unit: "each" },
  { name: "Jeyes Fluid 6x125ml", category: "Household", cost_price: 63.99, unit: "box" },
  { name: "Mix Me 6x750ml", category: "Household", cost_price: 63.99, unit: "box" },
  { name: "Sunlight Laundry Bar 42x500g", category: "Household", cost_price: 849.99, unit: "box" },
  { name: "Gento Washing Powder 60x250g", category: "Household", cost_price: 499.99, unit: "box" },
  { name: "Omo Washing Powder 12x1lt", category: "Household", cost_price: 599.99, unit: "box" },
  { name: "Omo Washing Powder 9x2kg", category: "Household", cost_price: 655.99, unit: "box" },
  { name: "Sunlight 5in1 Washing Powder 36x500g", category: "Household", cost_price: 580.99, unit: "box" },
  { name: "Sunlight 5in1 Washing Powder 9x2kg", category: "Household", cost_price: 575.99, unit: "box" },
  { name: "Surf Washing Powder 60x250g", category: "Household", cost_price: 239.99, unit: "box" },
  { name: "Surf Washing Powder 9x2kg", category: "Household", cost_price: 388.99, unit: "box" },
  { name: "Baby Soft 2 Ply Toilet Paper 18s", category: "Household", cost_price: 103.99, unit: "each" },
  { name: "Twinsaver 2 Ply Toilet Paper 18s", category: "Household", cost_price: 82.99, unit: "each" },
  { name: "Twinsaver Econo Toilet Paper 18s", category: "Household", cost_price: 104.99, unit: "each" },
  { name: "Pampers Jumbo Pack 4 Pack", category: "Household", cost_price: 189.99, unit: "each" },
  { name: "Always Maxi 8s/9s/10s 4 Pack", category: "Household", cost_price: 53.99, unit: "each" },
  // Personal Care
  { name: "Lux Bath Soap 24x100ml", category: "Personal Care", cost_price: 64.99, unit: "box" },
  { name: "Satiskin Bubble Bath 2lt", category: "Personal Care", cost_price: 62.99, unit: "each" },
  { name: "Lifebuoy Bar Soap 6x150g", category: "Personal Care", cost_price: 64.99, unit: "box" },
  { name: "Pearls Touch of Pearl Soap 10x300g", category: "Personal Care", cost_price: 93.99, unit: "box" },
  { name: "Dettol Bath Soap 6x2lt", category: "Personal Care", cost_price: 93.99, unit: "box" },
  { name: "Ingram's Camphor Cream 400g", category: "Personal Care", cost_price: 36.99, unit: "each" },
  { name: "Dark & Lovely Beautiful Beginnings Relaxer", category: "Personal Care", cost_price: 69.99, unit: "each" },
  { name: "Dawn Body Lotion 6x200ml", category: "Personal Care", cost_price: 79.99, unit: "box" },
  { name: "Dawn Body Lotion 6x400ml", category: "Personal Care", cost_price: 62.99, unit: "box" },
  { name: "Playboi/Playgirl Lotion/Cream 400ml", category: "Personal Care", cost_price: 33.99, unit: "each" },
  { name: "Playboi Lotion 6x400ml", category: "Personal Care", cost_price: 123.99, unit: "box" },
  { name: "Disprin Extra Strength 52x2s", category: "Personal Care", cost_price: 69.99, unit: "box" },
  { name: "Vaseline Petroleum Jelly 12x100ml", category: "Personal Care", cost_price: 129.99, unit: "box" },
  { name: "Bexona Reg. Roll On 6x50ml", category: "Personal Care", cost_price: 107.99, unit: "box" },
  { name: "Bexona (Shield) Petroleum Jelly 6x150ml", category: "Personal Care", cost_price: 174.99, unit: "box" },
  { name: "Clere Petroleum Jelly 6x250ml", category: "Personal Care", cost_price: 179.99, unit: "box" },
  { name: "Clere Gy-Co-Oil 6x100ml", category: "Personal Care", cost_price: 94.99, unit: "box" },
  { name: "Clere Regularis 6x100ml", category: "Personal Care", cost_price: 79.99, unit: "box" },
  { name: "Clere Body Lotion 500ml", category: "Personal Care", cost_price: 28.99, unit: "each" },
  { name: "Clere Body Lotion 6x200ml", category: "Personal Care", cost_price: 79.99, unit: "box" },
  { name: "Clere Body Cream 6x400ml", category: "Personal Care", cost_price: 123.99, unit: "box" },
  { name: "Johnsons Baby Jelly 6x325ml", category: "Personal Care", cost_price: 199.99, unit: "box" },
  { name: "Johnsons Baby Jelly 6x250ml", category: "Personal Care", cost_price: 214.99, unit: "box" },
  { name: "Johnsons Petroleum Cream 6x250ml", category: "Personal Care", cost_price: 196.99, unit: "box" },
  { name: "Lemon Asst 6x450ml", category: "Personal Care", cost_price: 254.99, unit: "box" },
  { name: "Barsol Cough Syrup Asst", category: "Personal Care", cost_price: 129.99, unit: "each" },
  { name: "Grand-Pa Headache Powder 38s", category: "Personal Care", cost_price: 309.99, unit: "box" },
  { name: "Grand-Pa Headache Powder 144s", category: "Personal Care", cost_price: 76.99, unit: "box" },
  { name: "Grand-Pa Headache Tablets 24s", category: "Personal Care", cost_price: 68.99, unit: "box" },
  { name: "Panado Tablets 24s", category: "Personal Care", cost_price: 28.99, unit: "box" },
  { name: "Panado Syrup Carded", category: "Personal Care", cost_price: 99.99, unit: "each" },
  // Dairy (Clover)
  { name: "Clover Family Snack Yoghurt 4x100g", category: "Dairy", cost_price: 9.99, unit: "each" },
  { name: "Clover Family Snack Yoghurt 900g", category: "Dairy", cost_price: 22.99, unit: "each" },
  { name: "Clover Berg Cheese 800g", category: "Dairy", cost_price: 59.99, unit: "each" },
  { name: "Clover Full Cream Milk 6x1lt", category: "Dairy", cost_price: 97.99, unit: "box" },
  { name: "Clover Ultra/Prisma UHT Milk 6x1lt", category: "Dairy", cost_price: 97.99, unit: "box" },
  { name: "Clover Fresh Milk 2lt", category: "Dairy", cost_price: 29.99, unit: "each" },
  { name: "Clover Yoghurt 6x100ml", category: "Dairy", cost_price: 16.99, unit: "box" },
];

const CATEGORIES = [...new Set(CATALOG.map(i => i.category))];

// Step 1: Browse & select | Step 2: Set selling price & stock per item
export default function DevlandCatalog({ open, onClose }) {
  const [step, setStep] = useState(1); // 1 = browse, 2 = set details
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [selected, setSelected] = useState({}); // idx -> true/false
  const [itemDetails, setItemDetails] = useState({}); // idx -> { selling_price, stock_quantity }
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const filtered = CATALOG.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || item.category === filterCat;
    return matchSearch && matchCat;
  });

  const toggleSelect = (idx) => {
    setSelected(prev => ({ ...prev, [idx]: !prev[idx] }));
    if (!itemDetails[idx]) {
      setItemDetails(prev => ({ ...prev, [idx]: { selling_price: "", stock_quantity: "" } }));
    }
  };

  const selectedItems = CATALOG
    .map((item, idx) => ({ item, idx }))
    .filter(({ idx }) => selected[idx]);

  const selectedCount = selectedItems.length;

  const updateDetail = (idx, field, value) => {
    setItemDetails(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: value } }));
  };

  const handleProceed = () => {
    if (selectedCount === 0) {
      toast({ title: "No items selected", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleAddToInventory = async () => {
    // Validate all have selling price
    const missing = selectedItems.filter(({ idx }) => !itemDetails[idx]?.selling_price || parseFloat(itemDetails[idx].selling_price) <= 0);
    if (missing.length > 0) {
      toast({ title: "Set selling prices", description: `${missing.length} item(s) still need a selling price`, variant: "destructive" });
      return;
    }

    setSaving(true);
    let added = 0;
    for (const { item, idx } of selectedItems) {
      const details = itemDetails[idx] || {};
      try {
        await api.entities.Product.create({
          name: item.name,
          category: item.category,
          cost_price: item.cost_price,
          selling_price: parseFloat(details.selling_price) || 0,
          stock_quantity: parseFloat(details.stock_quantity) || 0,
          unit: item.unit,
          supplier_id: "devland",
          is_active: true,
          notes: "Added from Devland Cash & Carry catalog"
        });
        added++;
      } catch (e) { /* skip */ }
    }
    setSaving(false);
    toast({ title: `✅ ${added} item(s) added to inventory!` });
    setSelected({});
    setItemDetails({});
    setStep(1);
    onClose();
  };

  const handleClose = () => {
    setStep(1);
    setSearch("");
    setFilterCat("All");
    setSelected({});
    setItemDetails({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0">
        {step === 1 ? (
          <>
            <DialogHeader className="px-4 pt-4 pb-2 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold">Devland Cash & Carry — Catalog</DialogTitle>
                  <p className="text-xs text-gray-500 mt-0.5">Select items to add to your inventory · Cost prices from July 2026 promotions</p>
                </div>
                {selectedCount > 0 && (
                  <Badge className="bg-green-600 text-white text-sm px-3 py-1">{selectedCount} selected</Badge>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input className="pl-8 h-8 text-sm" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {["All", ...CATEGORIES].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCat(cat)}
                      className={`px-2 py-1 rounded-lg text-xs whitespace-nowrap font-medium transition-colors ${filterCat === cat ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filtered.map((item) => {
                const globalIdx = CATALOG.indexOf(item);
                const isSelected = !!selected[globalIdx];
                return (
                  <div
                    key={globalIdx}
                    onClick={() => toggleSelect(globalIdx)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? "border-green-500 bg-green-50" : "border-gray-100 bg-white hover:bg-gray-50"}`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "border-green-600 bg-green-600" : "border-gray-300"}`}>
                      {isSelected && <Check size={13} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
                        <span className="text-[10px] text-gray-400">{item.unit}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-blue-700 text-sm">R {item.cost_price.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400">cost price</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                onClick={handleProceed}
                disabled={selectedCount === 0}
              >
                <ChevronRight size={16} />
                Next: Set Prices ({selectedCount} item{selectedCount !== 1 ? "s" : ""})
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="px-4 pt-4 pb-2 border-b">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(1)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ArrowLeft size={18} className="text-gray-600" />
                </button>
                <div>
                  <DialogTitle className="text-lg font-bold">Set Selling Price & Stock</DialogTitle>
                  <p className="text-xs text-gray-500">{selectedCount} item{selectedCount !== 1 ? "s" : ""} selected from Devland catalog</p>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {selectedItems.map(({ item, idx }) => {
                const details = itemDetails[idx] || {};
                const sellingPrice = parseFloat(details.selling_price) || 0;
                const markup = sellingPrice > 0 ? (((sellingPrice - item.cost_price) / item.cost_price) * 100).toFixed(1) : null;
                return (
                  <div key={idx} className="bg-white rounded-xl border p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
                          <span className="text-xs text-blue-700 font-medium">Cost: R {item.cost_price.toFixed(2)}</span>
                        </div>
                      </div>
                      {markup !== null && (
                        <Badge className={`text-xs ml-2 ${parseFloat(markup) >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {markup}% markup
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Selling Price (R) *</Label>
                        <Input
                          type="number"
                          className="mt-1 h-9 text-sm"
                          placeholder="e.g. 39.99"
                          value={details.selling_price || ""}
                          onChange={e => updateDetail(idx, "selling_price", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Stock Quantity Bought</Label>
                        <Input
                          type="number"
                          className="mt-1 h-9 text-sm"
                          placeholder="e.g. 10"
                          value={details.stock_quantity || ""}
                          onChange={e => updateDetail(idx, "stock_quantity", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                onClick={handleAddToInventory}
                disabled={saving}
              >
                <ShoppingCart size={16} />
                {saving ? "Adding to Inventory..." : `Add ${selectedCount} item${selectedCount !== 1 ? "s" : ""} to Inventory`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}