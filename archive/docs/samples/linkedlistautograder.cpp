#include <iostream>
#include <string>
using namespace std;
 
struct PatientNode {
public:
    std::string name;
    int priority;
    PatientNode* next;   // pointer to next node (nullptr if none)
    PatientNode(std::string name = "", int priority = 0,
                PatientNode* next = nullptr);
private:
};
std::ostream& operator <<(std::ostream& out, const PatientNode& node);
 
PatientNode::PatientNode(std::string name, int priority, PatientNode* next) {
    this->name = name;
    this->priority = priority;
    this->next = next;
}
std::ostream& operator <<(std::ostream& out, const PatientNode& node) {
    return out << node.priority << ":" << node.name;
}
 
class PatientQueue {
public:
    PatientQueue() {}
    ~PatientQueue() {}
    virtual bool isEmpty() {return false;}
    virtual void newPatient(string name, int priority) {}
    virtual string processPatient() {return "";}
    virtual string toString() { return "";}
 
private:
    friend ostream& operator <<(ostream& out, PatientQueue& queue) {
        out << queue.toString();
        return out;
    }
};
ostream& operator <<(ostream& out, PatientQueue& queue);
 
class LinkedListPatientQueue : public PatientQueue {
public:
    LinkedListPatientQueue();
    ~LinkedListPatientQueue();
    bool isEmpty();
    void newPatient(string name, int priority);
    string processPatient();
    string toString();
 
private:
    PatientNode* front; //pointer to front of list
};
 
LinkedListPatientQueue::LinkedListPatientQueue() { //constructor
    front = NULL; //set front node to null initially
}
 
LinkedListPatientQueue::~LinkedListPatientQueue() { //destructor
    PatientNode* next; //create next PatientNode pointer
    while (front != NULL) { //while the front is not null
        next = front->next; //next is fron't next node
        delete front; //delete front
        front = next; //set front to next
    }
    delete next; //delete next PatientNode
}
 
bool LinkedListPatientQueue::isEmpty() { //check if list is empty by seeing if front node is null
    return front == NULL;
}
 
void LinkedListPatientQueue::newPatient(string name, int priority) { //enqueue new patient
    PatientNode *patient = new PatientNode(name, priority, NULL); //create new PatientNode with parameters
    PatientNode *temp = front; //create temp PatientNode set to front of list
    if(front == NULL){ //if front is null set front to patient (if list is empty)
        front = patient;
    } else if (front->priority > priority){ //add new patient to front if front's priority is greater than priority
        patient->next = temp; //next node after patient is set to temp
        front = patient; //set front to point to patient
    } else {
        while (temp->next != NULL) {
            if(temp->next->priority <= priority) { //
                temp = temp->next;
            } else {
                patient->next = temp->next;
                temp->next = patient;
                return;
            }
        }
        temp->next = patient;
    }
}
 
string LinkedListPatientQueue::processPatient() { //dequeue first patient
    if (isEmpty()) { //if list is empty throw error
        throw "Cannot perform operation because LinkedList is empty";
    }
    string patientName = front->name; //set patientName to front name
     if (front->next == nullptr) { //if the next node behind front is null
         delete front; //delete front and return name
         return patientName;
     }
     PatientNode *temp = front; //else set temp PatientNode to front
     front = temp->next; //set front to point to next element after temp
     delete temp; //delete temp and return name
     return patientName;
}

string LinkedListPatientQueue::toString() { //return list elements as string
    string result = "{";
    PatientNode *current = front;
    if(current == NULL){
        return result + "}";
    }
    while(current->next != NULL){ //while there is a next element
        result += current->name + ", "; //iterate through list and return list priorities and names
        current = current->next;
    }
    result += ":" + current->name + "}";
    return result;
}

int main() {
    LinkedListPatientQueue pq;
    pq.newPatient("aa", 10);
    pq.newPatient("bb", 20);
    pq.newPatient("cc", 30);
    pq.newPatient("dd", 40);
    pq.newPatient("ee", 50);
    pq.newPatient("ff", 60);
    while (!pq.isEmpty()) {
        cout << pq.processPatient() << endl;
    }
    cout << pq << endl;
    return 0;
}
