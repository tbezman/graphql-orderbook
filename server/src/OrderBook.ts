const Socket = require('ws');
const {Md5} = require('ts-md5/dist/md5');

// buy, price, size
type OrderBookChange = [string, string, string];

type BookUpdate = {
    type: string;
    product_id: string;
    changes: OrderBookChange[];
    time: string;
}

type PriceEntry = {
    price: string;
    priceNumber: number;
    size: string;
    sizeNumber: number;
};

type BookSide = PriceEntry[];

type ProductBook = {
    buys: BookSide;
    sells: BookSide;
    currentHash: string;
}

// price, size
type SnapshotEntry = [string, string];

type OrderBookSnapshot = {
    type: 'snapshot';
    product_id: string;
    asks: SnapshotEntry[];
    bids: SnapshotEntry[];
}

const constructBookFromSnapshot = (snapshot: OrderBookSnapshot): ProductBook => {
    const buyEntries: PriceEntry[] = [];
    const sellEntries: PriceEntry[] = [];

    for (const ask of snapshot.asks) {
        const [price, size] = ask;

        const entry = {price, size, priceNumber: parseFloat(price), sizeNumber: parseFloat(size)};

        sellEntries.push(entry);
    }

    for (const bid of snapshot.bids) {
        const [price, size] = bid;


        const entry = {
            price,
            size,
            priceNumber: parseFloat(price),
            sizeNumber: parseFloat(size),
        };

        buyEntries.push(entry);
    }

    const hash = Md5.hashStr(JSON.stringify({buys: buyEntries, sells: sellEntries}));

    return {
        buys: buyEntries,
        sells: sellEntries,
        currentHash: hash
    };
};

type InsertOperation = {
    type: 'insert',
    side: string,
    index: number;
    entry: PriceEntry;
}

type DeleteOperation = {
    type: 'delete',
    side: string,
    index: number;
}

type UpdateOperation = {
    type: 'update',
    side: string,
    index: number;
    entry: PriceEntry;
}

type Operation = UpdateOperation | DeleteOperation | InsertOperation;

export class OrderBook {
    socket: WebSocket;

    books: Record<string, ProductBook> = {};

    queuedOperations: Operation[] = [];

    start() {
        if (this.socket) {
            this.socket.close();
        }

        this.socket = new Socket('wss://ws-feed.pro.coinbase.com');

        this.socket.onopen = () => {
            this.send({"type": "subscribe", "channels": [{"name": "level2_50", "product_ids": ["ETH-USD"]}]});
        };

        this.socket.onmessage = (event: MessageEvent) => {
            const message = JSON.parse(event.data);

            switch (message.type) {
                case 'snapshot':
                    const snapshot = message as OrderBookSnapshot;

                    this.books[snapshot.product_id] = constructBookFromSnapshot(snapshot);

                    break;
                case 'l2update':
                    const update = message as BookUpdate;
                    const book = this.books[update.product_id];

                    for (const change of update.changes) {
                        const [side, price, size] = change;

                        const bookSide = side === 'buy' ? book.buys : book.sells;

                        const priceNumber = parseFloat(price);
                        const sizeNumber = parseFloat(size);


                        if (sizeNumber === 0) {
                            const foundIndex = bookSide.findIndex(it => it.price === price);

                            bookSide.splice(foundIndex, 1);

                            this.queuedOperations.push({side, type: 'delete', index: foundIndex});
                        } else {
                            const foundIndex = bookSide.findIndex(it => it.price === price);

                            if (foundIndex > -1) {
                                // Update existing

                                bookSide[foundIndex].size = size;
                                bookSide[foundIndex].sizeNumber = sizeNumber;

                                this.queuedOperations.push({type: 'update', side, entry: bookSide[foundIndex], index: foundIndex});
                            } else {
                                // Insert new
                                const entry = {
                                    price,
                                    size,
                                    sizeNumber,
                                    priceNumber,
                                };

                                let insertIndex;
                                for (insertIndex = 0; insertIndex < bookSide.length; insertIndex++) {
                                    const current = bookSide[insertIndex];

                                    if (side === 'buy') {
                                        if (priceNumber > current.priceNumber) {
                                            break;
                                        }
                                    } else {
                                        if (priceNumber < current.priceNumber) {
                                            break;
                                        }
                                    }
                                }

                                bookSide.splice(insertIndex, 0, entry);

                                this.queuedOperations.push({type: 'insert', side, entry: entry, index: insertIndex});
                            }
                        }
                    }
            }
        };

        return this;
    }

    send(message: any) {
        this.socket.send(JSON.stringify(message));
    }
}
