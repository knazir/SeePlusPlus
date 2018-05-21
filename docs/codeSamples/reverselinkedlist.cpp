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

void reverse() {
    ListNode *temp = nullptr;
    ListNode *curr = head;
    ListNode *next;
    while (curr != nullptr) {
        next = curr->next;
        curr->next = temp;
        temp = curr;
        curr = next;
    }
    head = temp;
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
    reverse();
    free(head);
    head = nullptr;
    return 0;
}
