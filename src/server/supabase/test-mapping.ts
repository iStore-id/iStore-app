import { OrderRepository } from "./order-repository";
import { Order } from "../../types/order";

async function testMapping() {
    console.log("Running mapping test...");
    const repo = OrderRepository.getInstance() as any;
    
    const mockOrder: Partial<Order> = {
        id: "123",
        invoice: "INV-001",
        userId: "user-123",
        quantity: 1,
        price: 1000,
    };
    
    const row = repo.mapOrderToRow(mockOrder);
    console.assert(row.user_id === "user-123", "Mapping failed: user_id");
    console.assert(row.price === 1000, "Mapping failed: price");
    
    const domain = repo.mapRowToOrder({
        id: "123",
        invoice: "INV-001",
        user_id: "user-123",
        quantity: 1,
        price: 1000
    });
    console.assert(domain.userId === "user-123", "Unmapping failed: userId");
    console.assert(domain.price === 1000, "Unmapping failed: price");
    
    console.log("Mapping test passed!");
}

testMapping().catch(console.error);
