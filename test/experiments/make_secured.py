"""Derive the access-controlled variant of the N2N contracts from the repository originals.
Changes (all mechanical, nothing else in the originals is altered):
 1. Operator role: every state-changing public function gets `onlyOperator`. The deployer is the first
    operator, so the harness needs no password or extra account; other accounts are rejected.
 2. ABATLTranslation.registerABATL: the existence/activity checks that are commented out in the original
    are enabled (NIASRegistry gets the two view helpers they need).
 3. SequencePathRouter: keccak256 hash of the stored sequence (seqHash, verifyPath), and reroutePath
    refuses a backup containing a node that is inactive in the NIDRegistry (when one is configured).
"""
import re, os
SRC, DST = "contracts/original", "contracts/secured"
os.makedirs(DST, exist_ok=True)
ROLE = '''
    mapping(address => bool) public isOperator;
    modifier onlyOperator() { require(isOperator[msg.sender], "Not operator"); _; }
    function setOperator(address _a, bool _v) public onlyOperator { isOperator[_a] = _v; }
'''
for f in sorted(os.listdir(SRC)):
    s = open(os.path.join(SRC, f)).read()
    name = f[:-4]
    # constructor / role block
    m = re.search(r"contract %s \{" % name, s)
    s = s[:m.end()] + ROLE + s[m.end():]
    if "constructor(" in s:
        s = re.sub(r"(constructor\([^)]*\)\s*\{)", r"\1\n        isOperator[msg.sender] = true;", s, count=1)
    else:
        s = s.replace(ROLE, ROLE + "    constructor() { isOperator[msg.sender] = true; }\n", 1)
    # modifier on state-changing public functions
    s = re.sub(r"\)\s*public\s*\{", ") public onlyOperator {", s)
    s = s.replace("function setOperator(address _a, bool _v) public onlyOperator onlyOperator", "function setOperator(address _a, bool _v) public onlyOperator")
    if name == "ABATLTranslation":
        s = s.replace("        /*\n        // Verify that NID and NIAS exist and are active", "        // Verify that NID and NIAS exist and are active")
        s = s.replace('require(bytes(abatlRecords[_abatlId].abatlId).length == 0, "ABATL already registered");\n         */', 'require(bytes(abatlRecords[_abatlId].abatlId).length == 0, "ABATL already registered");')
    if name == "NIASRegistry":
        i = s.rindex("}")
        s = s[:i] + '''
    function niasExists(string memory _primaryId) public view returns (bool) { return bytes(autonomousSystems[_primaryId].primaryId).length > 0; }
    function isNIASActive(string memory _primaryId) public view returns (bool) { return autonomousSystems[_primaryId].isActive; }
}
'''
    if name == "SequencePathRouter":
        s = s.replace("contract SequencePathRouter {", "interface INodeRegistry { function isNodeActive(string memory) external view returns (bool); }\n\ncontract SequencePathRouter {", 1)
        s = s.replace("    mapping(string => uint256) public nodePacketCount;", "    mapping(string => uint256) public nodePacketCount;\n    mapping(string => bytes32) public seqHash;\n    INodeRegistry public nodeRegistry;\n    function setNodeRegistry(address _r) public onlyOperator { nodeRegistry = INodeRegistry(_r); }\n    function verifyPath(string memory _id) public view returns (bool) { return seqHash[_id] == keccak256(abi.encode(paths[_id].pathSequence)); }", 1)
        # hash at creation
        s = s.replace("        // Create path record\n", "        seqHash[_pathId] = keccak256(abi.encode(_pathSequence));\n        // Create path record\n", 1)
        # active check and hash refresh on reroute
        s = s.replace("        // Update path sequence\n        paths[_pathId].pathSequence = alternativePath.pathSequence;",
          "        if (address(nodeRegistry) != address(0)) {\n            for (uint k = 1; k + 1 < alternativePath.pathSequence.length; k++) {\n                require(nodeRegistry.isNodeActive(alternativePath.pathSequence[k]), \"Backup node inactive\");\n            }\n        }\n        // Update path sequence\n        paths[_pathId].pathSequence = alternativePath.pathSequence;\n        seqHash[_pathId] = keccak256(abi.encode(alternativePath.pathSequence));", 1)
    open(os.path.join(DST, f), "w").write(s)
print("secured contracts written")
