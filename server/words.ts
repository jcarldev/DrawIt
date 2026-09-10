export type WordPool = "mixed" | "animals" | "food" | "objects" | "places";

const wordPools: Record<Exclude<WordPool, "mixed">, string[]> = {
  animals: [
    "cat",
    "dog",
    "lion",
    "tiger",
    "elephant",
    "monkey",
    "giraffe",
    "zebra",
    "rabbit",
    "horse",
    "cow",
    "chicken",
    "penguin",
    "dolphin",
    "whale",
    "shark",
    "turtle",
    "snake",
    "frog",
    "butterfly",
  ],

  food: [
    "pizza",
    "burger",
    "sandwich",
    "spaghetti",
    "pancake",
    "donut",
    "cake",
    "ice cream",
    "apple",
    "banana",
    "watermelon",
    "carrot",
    "potato",
    "popcorn",
    "sushi",
    "noodles",
    "taco",
    "cookie",
    "cheese",
    "chocolate",
  ],

  objects: [
    "chair",
    "table",
    "phone",
    "laptop",
    "keyboard",
    "mouse",
    "book",
    "pencil",
    "umbrella",
    "backpack",
    "clock",
    "camera",
    "television",
    "bicycle",
    "guitar",
    "lamp",
    "bottle",
    "key",
    "ball",
    "scissors",
  ],

  places: [
    "school",
    "hospital",
    "airport",
    "beach",
    "park",
    "restaurant",
    "library",
    "museum",
    "castle",
    "farm",
    "mountain",
    "island",
    "city",
    "village",
    "supermarket",
    "hotel",
    "church",
    "zoo",
    "stadium",
    "cinema",
  ],
};

const allWords = Object.values(wordPools).flat();

export function getRandomWord(): string {
  return allWords[Math.floor(Math.random() * allWords.length)];
}

export function getRandomWordFromPool(
  pool: Exclude<WordPool, "mixed">,
): string {
  const words = wordPools[pool];

  return words[Math.floor(Math.random() * words.length)];
}
