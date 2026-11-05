pragma circom 2.0.0;
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
template PaysValidity() {
    signal input txHash; signal input senderComm;
    signal input sender; signal input receiver; signal input amount; signal input balance; signal input nonce; signal input salt;
    component h = Poseidon(4);
    h.inputs[0] <== sender; h.inputs[1] <== receiver; h.inputs[2] <== amount; h.inputs[3] <== nonce;
    h.out === txHash;
    component c = Poseidon(2);
    c.inputs[0] <== sender; c.inputs[1] <== salt;
    c.out === senderComm;
    component ge = GreaterEqThan(64);
    ge.in[0] <== balance; ge.in[1] <== amount;
    ge.out === 1;
    component nz = IsZero();
    nz.in <== nonce;
    nz.out === 0;
}
component main {public [txHash, senderComm]} = PaysValidity();
