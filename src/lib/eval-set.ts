export type EvalCase = {
  title: string;
  body: string;
  expectedCategory: "fox" | "wolf" | "dog" | "bear";
};

export const EVAL_SET: EvalCase[] = [
  {
    title: "The Behavior of Red Foxes",
    body: "Red foxes are cunning, adaptable predators found across diverse habitats, known for their keen senses and opportunistic hunting.",
    expectedCategory: "fox",
  },
  {
    title: "Understanding Vulpes Vulpes",
    body: "This species is a cunning nocturnal canid found across the northern hemisphere, known for its keen hearing and adaptability.",
    expectedCategory: "fox",
  },
  {
    title: "Urban Wildlife: The Cunning Survivor",
    body: "Increasingly common in cities, this orange-coated animal thrives by scavenging and adapting to human environments.",
    expectedCategory: "fox",
  },
  {
    title: "Wolf Pack Dynamics in the Wild",
    body: "Wolves live and hunt in tightly organized packs with complex social hierarchies and cooperative hunting strategies.",
    expectedCategory: "wolf",
  },
  {
    title: "The Howl of Canis Lupus",
    body: "This large canid communicates across vast distances through long, mournful howls that coordinate pack movement.",
    expectedCategory: "wolf",
  },
  {
    title: "Apex Predators of the Forest",
    body: "Few animals command as much respect in the forest ecosystem as this gray, pack-hunting predator.",
    expectedCategory: "wolf",
  },
  {
    title: "Choosing the Right Breed for Your Family",
    body: "When selecting a companion animal for your household, consider temperament, size, and exercise needs.",
    expectedCategory: "dog",
  },
  {
    title: "Man's Best Friend: A History",
    body: "Domesticated over 15,000 years ago, this loyal companion animal has been bred into hundreds of distinct varieties.",
    expectedCategory: "dog",
  },
  {
    title: "Puppy Training Tips for New Owners",
    body: "House-training a new companion animal requires patience, consistency, and positive reinforcement techniques.",
    expectedCategory: "dog",
  },
  {
    title: "Grizzly Bears and Hibernation Patterns",
    body: "During winter months, these massive omnivores enter a state of reduced metabolic activity in dens.",
    expectedCategory: "bear",
  },
  {
    title: "The Diet of Wild Ursidae",
    body: "This large, powerful omnivore consumes everything from berries and fish to small mammals depending on season.",
    expectedCategory: "bear",
  },
  {
    title: "Encounters with Large Forest Mammals",
    body: "If you come across this massive, thick-furred animal in the wild, experts recommend staying calm and backing away slowly.",
    expectedCategory: "bear",
  },
];
