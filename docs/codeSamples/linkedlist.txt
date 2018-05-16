#include <iostream>
#include <string>

using namespace std;

typedef struct ListNode {
    int val;
    ListNode *next;
} ListNode;

ListNode *head = nullptr;

void add(int val) {
    ListNode *newNode = new ListNode{val, nullptr};
    if (head == nullptr) {
        head = newNode;
        return;
    }
    ListNode *curr = head;
    while (curr->next != nullptr) curr = curr->next;
    curr->next = newNode;
}

void plus1() {
    for (ListNode *curr = head; curr != nullptr; curr = curr->next) {
        curr->val++;
    }
}

void free(ListNode *curr) {
    if (!curr) return;
    free(curr->next);
    delete curr;
}

int main() {
    cout << "yay linked lists!" << endl;
    add(0);
    add(8);
    add(3);
    plus1();
    free(head);
    head = nullptr;
    return 0;
}
