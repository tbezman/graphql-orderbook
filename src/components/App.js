import React from 'react'
import {gql} from 'apollo-boost'
import {useQuery, useSubscription} from '@apollo/react-hooks';

const ORDER_BOOK_SUBSCRIPTION = gql`
    subscription bookUpdates {
        orderBookUpdates {
            type,
            side,
            entry {
                size,
                price
            }
            index,
        }
    }
`;

const ORDER_BOOK_QUERY = gql`
    query {
        orderBook {
            buys {
                size
                price
            }
            sells {
                price
                size
            }
        }
    }

`;

const emptyBook = {buys: [], sells: []};

export default function () {
    const [orderBook, setOrderBook] = React.useState(emptyBook);

    const {loading, error, data} = useQuery(ORDER_BOOK_QUERY);
    const {data: subData} = useSubscription(ORDER_BOOK_SUBSCRIPTION);

    React.useEffect(() => {
        if (data) {
            setOrderBook(data.orderBook);
        }
    }, data);

    React.useMemo(() => {
        if (!subData) return;

        const {orderBookUpdates} = subData;
        const nextBook = {buys: [...orderBook.buys], sells: [...orderBook.sells]};

        for (const update of orderBookUpdates) {
            const {side, index, type, entry} = update;
            const book = side === 'buy' ? nextBook.buys : nextBook.sells;

            switch (type) {
                case 'update':
                    book[index] = entry;
                    break;
                case 'insert':
                    book.splice(index, 0, entry);
                    break;
                case 'delete':
                    book.splice(index, 1);
                    break;
            }
        }

        setOrderBook(nextBook);
    }, [subData]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error</div>;

    const {buys, sells} = orderBook;

    return (
        <>
            <h3>
                sells
            </h3>
            <ul>
                {sells.slice(0, 4).reverse().map(it => <li>{it.price} {it.size}</li>)}
            </ul>
            <h3>
                Buys
            </h3>
            <ul>
                {buys.slice(0, 4).map(it => <li>{it.price} {it.size}</li>)}
            </ul>
        </>
    )
}
