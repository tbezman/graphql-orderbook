const {GraphQLServer, PubSub} = require('graphql-yoga');
const {OrderBook} = require('./OrderBook');

const typeDefs = `
  type OrderBook {
    buys: [PriceEntry!]! 
    sells: [PriceEntry!]! 
  }

  type Query {
    orderBook: OrderBook!
  }

 type PriceEntry {
    size: String! 
    price: String! 
  }
  
  type Operation {
    type: String! 
    side: String!
    index: Int!
    entry: PriceEntry
  } 
  
  type Subscription {
    orderBookUpdates: [Operation!]!
  }
`;

const resolvers = {
    Query: {
        orderBook: () => orderBook.books['ETH-USD'],
    },
    Subscription: {
        orderBookUpdates: {
            subscribe: (parent, args, {pubsub}) => {
                return pubsub.asyncIterator('orderBook')
            },
        },
    },
};

const pubsub = new PubSub();
const server = new GraphQLServer({typeDefs, resolvers, context: {pubsub}});

const orderBook = new OrderBook().start();

setInterval(() => {
    pubsub.publish('orderBook', {orderBookUpdates: orderBook.queuedOperations});
    orderBook.queuedOperations= [];
}, 1000);

server.start(() => {
    console.log("Server started");
});