import React from 'react'
import ReactDOM from 'react-dom'
import '../src/styles/index.css'
import App from '../src/components/App'
import {ApolloProvider} from '@apollo/react-hooks'
import ApolloClient from "apollo-client";
// Setup the network "links"
import { WebSocketLink } from 'apollo-link-ws';
import { HttpLink } from 'apollo-link-http';
import { split } from 'apollo-link';
import { getMainDefinition } from 'apollo-utilities';
import { InMemoryCache } from 'apollo-cache-inmemory';

const httpLink = new HttpLink({
    uri: "http://localhost:4000", // use https for secure endpoint
});

// Create a WebSocket link:
const wsLink = new WebSocketLink({
    uri: "ws://localhost:4000", // use wss for a secure endpoint
    options: {
        reconnect: true
    }
});

// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = split(
    // split based on operation type
    ({ query }) => {
        const { kind, operation } = getMainDefinition(query);
        return kind === 'OperationDefinition' && operation === 'subscription';
    },
    wsLink,
    httpLink,
);

// Instantiate client
const client = new ApolloClient({
    link,
    cache: new InMemoryCache()
});

//Apollo Client
ReactDOM.render(
    <ApolloProvider client={client}>
        <App/>
    </ApolloProvider>,
    document.getElementById('root'),
)