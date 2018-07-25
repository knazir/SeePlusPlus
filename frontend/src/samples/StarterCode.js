const code = `
#include <iostream>
#include <string>

using namespace std;

struct ListNode {
    int val;
    ListNode *next;
};

void addToBack(ListNode *&front, int val) {
    ListNode *newNode = new ListNode{val, nullptr};
    if (front == nullptr) {
        front = newNode;
        return;
    }
    ListNode *curr = front;
    while (curr->next != nullptr) {
        curr = curr->next;
    }
    curr->next = newNode;
}

int main() {
    ListNode *list1 = nullptr;
    addToBack(list1, 1);
    addToBack(list1, 5);
    
    ListNode *list2 = nullptr;
    addToBack(list2, 2);
    addToBack(list2, 3);
    addToBack(list2, 4);

    return 0;
}
`.trim();

module.exports = { code };
