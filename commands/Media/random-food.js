const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const RECIPES = [
    {
        name: 'Margherita Pizza',
        emoji: '🍕',
        description: 'A classic Neapolitan pie with tangy tomato sauce and creamy mozzarella.',
        image: 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&w=1200&q=80',
        ingredients: [
            'Pizza dough',
            'Tomato sauce',
            'Fresh mozzarella',
            'Fresh basil leaves',
            'Olive oil',
            'Sea salt'
        ],
        instructions: [
            'Preheat oven with a stone or steel to 250°C / 480°F.',
            'Stretch dough into a thin round base.',
            'Spread a thin layer of tomato sauce and top with torn mozzarella.',
            'Bake for 6-8 minutes until crust is blistered.',
            'Finish with basil leaves, a drizzle of olive oil, and a pinch of salt.'
        ]
    },
    {
        name: 'Spicy Ramen Bowl',
        emoji: '🍜',
        description: 'Comforting broth with chewy noodles, soft-boiled egg, and chili heat.',
        image: 'https://images.unsplash.com/photo-1512058564366-c9e3e0464b8f?auto=format&fit=crop&w=1200&q=80',
        ingredients: [
            'Chicken or veggie broth',
            'Ramen noodles',
            'Soy sauce & miso paste',
            'Chili paste (gochujang or sambal)',
            'Soft-boiled egg',
            'Bok choy & scallions',
            'Sesame oil'
        ],
        instructions: [
            'Simmer broth with soy sauce, miso, and chili paste for 10 minutes.',
            'Cook ramen separately until just tender.',
            'Blanch greens and slice scallions.',
            'Assemble bowl with noodles, broth, greens, egg, and drizzle sesame oil.',
            'Garnish with extra chili, sesame seeds, or nori if desired.'
        ]
    },
    {
        name: 'Berry Parfait',
        emoji: '🍓',
        description: 'Layers of creamy yogurt, crunchy granola, and vibrant berries.',
        image: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=1200&q=80',
        ingredients: [
            'Greek yogurt',
            'Mixed berries (strawberries, blueberries, raspberries)',
            'Granola',
            'Honey or maple syrup',
            'Fresh mint leaves'
        ],
        instructions: [
            'Layer yogurt, berries, and granola in a glass.',
            'Repeat layers until the glass is full.',
            'Drizzle with honey or maple syrup.',
            'Top with fresh mint and serve immediately.'
        ]
    },
    {
        name: 'Garlic Butter Steak',
        emoji: '🥩',
        description: 'Pan-seared steak basted with garlic-herb butter for a rich finish.',
        image: 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=1200&q=80',
        ingredients: [
            'Ribeye or sirloin steak',
            'Butter',
            'Garlic cloves',
            'Fresh thyme & rosemary',
            'Salt & black pepper'
        ],
        instructions: [
            'Season steak generously with salt and pepper.',
            'Sear in a hot skillet for 2-3 minutes per side.',
            'Add butter, smashed garlic, and herbs; baste steak continuously.',
            'Cook to desired doneness and rest for 5 minutes before slicing.'
        ]
    },
    {
        name: 'Mediterranean Buddha Bowl',
        emoji: '🥗',
        description: 'A colorful bowl packed with grains, roasted veggies, and tangy tzatziki.',
        image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=1200&q=80',
        ingredients: [
            'Cooked quinoa or couscous',
            'Roasted chickpeas & sweet potatoes',
            'Cucumber, cherry tomatoes, and olives',
            'Tzatziki or hummus',
            'Feta cheese',
            'Lemon wedges'
        ],
        instructions: [
            'Fill a bowl with warm grains as the base.',
            'Arrange roasted veggies, chickpeas, and fresh toppings in sections.',
            'Add a generous spoon of tzatziki or hummus.',
            'Sprinkle with feta and squeeze lemon before serving.'
        ]
    }
];

function pickRandomRecipe() {
    return RECIPES[Math.floor(Math.random() * RECIPES.length)];
}

module.exports = {
    category: 'Media',
    data: new SlashCommandBuilder()
        .setName('food')
        .setDescription('Serve up a random foodie photo and recipe inspiration!')
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you (ephemeral)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const isPrivate = interaction.options.getBoolean('private') || false;
        const recipe = pickRandomRecipe();

        const embed = new EmbedBuilder()
            .setTitle(`${recipe.emoji || '🍽️'} ${recipe.name}`)
            .setDescription(recipe.description)
            .setColor(0xffb347)
            .addFields(
                {
                    name: 'Ingredients',
                    value: recipe.ingredients.map(item => `• ${item}`).join('\n')
                },
                {
                    name: 'Instructions',
                    value: recipe.instructions.map((step, index) => `${index + 1}. ${step}`).join('\n')
                }
            )
            .setImage(recipe.image)
            .setFooter({ text: 'Bon appétit! 🎉' })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: isPrivate ? MessageFlags.Ephemeral : undefined
        });
    }
};
