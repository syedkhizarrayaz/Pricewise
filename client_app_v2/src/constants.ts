import { ShoppingList, Store } from './types';

export const MOCK_STORES: Store[] = [
  {
    id: '1',
    name: 'Whole Foods Market',
    address: '123 Market St, San Francisco, CA',
    distance: 0.8,
    rating: 4.5,
    isOpen: true,
    location: { lat: 37.7749, lng: -122.4194 },
    phone: '(415) 555-0123',
    website: 'https://wholefoods.com'
  },
  {
    id: '2',
    name: 'Trader Joe\'s',
    address: '456 Pine St, San Francisco, CA',
    distance: 1.2,
    rating: 4.7,
    isOpen: true,
    location: { lat: 37.7833, lng: -122.4167 }
  },
  {
    id: '3',
    name: 'Safeway',
    address: '789 Ocean Ave, San Francisco, CA',
    distance: 2.5,
    rating: 3.8,
    isOpen: false,
    location: { lat: 37.7219, lng: -122.4594 }
  }
];

export const MOCK_LISTS: ShoppingList[] = [
  {
    id: 'l1',
    name: 'Weekly Groceries',
    items: ['Milk', 'Eggs', 'Bread', 'Avocados', 'Chicken Breast'],
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000,
    userId: 'user1'
  },
  {
    id: 'l2',
    name: 'Dinner Party',
    items: ['Steak', 'Red Wine', 'Asparagus', 'Potatoes'],
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 4,
    userId: 'user1'
  }
];

export const MAJOR_RETAILERS = [
  'walmart', 'kroger', 'heb', 'target', 'costco'
];

export const STORE_LOGOS: Record<string, string> = {
  'walmart': 'https://logo.clearbit.com/walmart.com',
  'kroger': 'https://logo.clearbit.com/kroger.com',
  'target': 'https://logo.clearbit.com/target.com',
  'costco': 'https://logo.clearbit.com/costco.com',
  'sam\'s club': 'https://logo.clearbit.com/samsclub.com',
  'sams club': 'https://logo.clearbit.com/samsclub.com',
  'whole foods': 'https://logo.clearbit.com/wholefoodsmarket.com',
  'safeway': 'https://logo.clearbit.com/safeway.com',
  'publix': 'https://logo.clearbit.com/publix.com',
  'albertsons': 'https://logo.clearbit.com/albertsons.com',
  'aldi': 'https://logo.clearbit.com/aldi.us',
  'aldi us': 'https://logo.clearbit.com/aldi.us',
  'aldi inc': 'https://logo.clearbit.com/aldi.us',
  'trader joe\'s': 'https://logo.clearbit.com/traderjoes.com',
  'trader joes': 'https://logo.clearbit.com/traderjoes.com',
  'meijer': 'https://logo.clearbit.com/meijer.com',
  'h-e-b': 'https://logo.clearbit.com/heb.com',
  'heb': 'https://logo.clearbit.com/heb.com',
  'heb grocery': 'https://logo.clearbit.com/heb.com',
  'walgreens': 'https://logo.clearbit.com/walgreens.com',
  'cvs': 'https://logo.clearbit.com/cvs.com',
  'cvs pharmacy': 'https://logo.clearbit.com/cvs.com',
  'amazon': 'https://logo.clearbit.com/amazon.com',
  'amazon fresh': 'https://logo.clearbit.com/amazon.com',
  'instacart': 'https://logo.clearbit.com/instacart.com',
  'ralphs': 'https://logo.clearbit.com/ralphs.com',
  'vons': 'https://logo.clearbit.com/vons.com',
  'wegmans': 'https://logo.clearbit.com/wegmans.com',
  'hy-vee': 'https://logo.clearbit.com/hy-vee.com',
  'giant': 'https://logo.clearbit.com/giantfood.com',
  'giant food': 'https://logo.clearbit.com/giantfood.com',
  'stop & shop': 'https://logo.clearbit.com/stopandshop.com',
  'stop and shop': 'https://logo.clearbit.com/stopandshop.com',
  'winco': 'https://logo.clearbit.com/wincofoods.com',
  'winco foods': 'https://logo.clearbit.com/wincofoods.com',
  'sprouts': 'https://logo.clearbit.com/sprouts.com',
  'sprouts farmers market': 'https://logo.clearbit.com/sprouts.com',
  'food lion': 'https://logo.clearbit.com/foodlion.com',
  'harris teeter': 'https://logo.clearbit.com/harristeeter.com',
  'shoprite': 'https://logo.clearbit.com/shoprite.com',
  'jewel-osco': 'https://logo.clearbit.com/jewelosco.com',
  'shaw\'s': 'https://logo.clearbit.com/shaws.com',
  'star market': 'https://logo.clearbit.com/starmarket.com',
  'acme': 'https://logo.clearbit.com/acmemarkets.com',
  'acme markets': 'https://logo.clearbit.com/acmemarkets.com',
  'tom thumb': 'https://logo.clearbit.com/tomthumb.com',
  'randalls': 'https://logo.clearbit.com/randalls.com',
  'pavilions': 'https://logo.clearbit.com/pavilions.com',
  'carrs': 'https://logo.clearbit.com/carrsqc.com',
  'haggen': 'https://logo.clearbit.com/haggen.com',
  'lucky': 'https://logo.clearbit.com/luckysupermarkets.com',
  'save mart': 'https://logo.clearbit.com/savemart.com',
  'smart & final': 'https://logo.clearbit.com/smartandfinal.com',
  'smart and final': 'https://logo.clearbit.com/smartandfinal.com',
  'stater bros': 'https://logo.clearbit.com/staterbros.com',
  'stater bros markets': 'https://logo.clearbit.com/staterbros.com',
  'fred meyer': 'https://logo.clearbit.com/fredmeyer.com',
  'fry\'s': 'https://logo.clearbit.com/frysfood.com',
  'fry\'s food': 'https://logo.clearbit.com/frysfood.com',
  'king soopers': 'https://logo.clearbit.com/kingsoopers.com',
  'smith\'s': 'https://logo.clearbit.com/smithsfoodanddrug.com',
  'smith\'s food and drug': 'https://logo.clearbit.com/smithsfoodanddrug.com',
  'dillons': 'https://logo.clearbit.com/dillons.com',
  'united supermarkets': 'https://logo.clearbit.com/unitedsupermarkets.com',
  'market street': 'https://logo.clearbit.com/marketstreetunited.com',
  'amigos': 'https://logo.clearbit.com/amigosunited.com',
  'albertsons market': 'https://logo.clearbit.com/albertsonsmarket.com',
  'foodmaxx': 'https://logo.clearbit.com/foodmaxx.com'
};
