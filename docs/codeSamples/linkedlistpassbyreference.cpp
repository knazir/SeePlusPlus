#include <iostream>
#include <string>

using namespace std;

typedef struct ListNode {
    int val;
    ListNode *next;
} ListNode;

void add(ListNode *&head, int val) {
    ListNode *newNode = new ListNode{val, nullptr};
    if (head == nullptr) {
        head = newNode;
        return;
    }
    ListNode *curr = head;
    while (curr->next != nullptr) curr = curr->next;
    curr->next = newNode;
}

void plus1(ListNode *head) {
    for (ListNode *curr = head; curr != nullptr; curr = curr->next) {
        curr->val++;
    }
}

int main() {
    ListNode *head = nullptr;
    add(head, 0);
    add(head, 8);
    add(head, 3);
    plus1(head); 
    return 0;
}
