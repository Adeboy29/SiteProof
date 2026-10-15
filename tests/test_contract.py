import json
import hashlib

def test_assessment_authorization_validation_consensus_and_immutability(direct_vm, direct_deploy, direct_bob):
    c = direct_deploy('contracts/siteproof.py')
    manifest = {'milestone_id':'m1','criteria_version':1,'criteria':['Strength report'],'evidence':[]}
    report = {'milestone_id':'m1','criteria_version':1,'outcome':'Insufficient evidence','findings':[{'criterion':'Strength report','status':'insufficient','evidence':[],'explanation':'No report supplied'}],'missing':['Strength report'],'uncertainty':'No inspection','human_inspection':True,'summary':'Human inspection required'}
    direct_vm.mock_llm(r'(?s).*', json.dumps(report))
    c.assess('request-1',json.dumps(manifest))
    assert json.loads(c.get_assessment('request-1')) == report
    assert c.get_manifest_hash('request-1') == hashlib.sha256(json.dumps(manifest).encode()).hexdigest()
    with direct_vm.expect_revert('Invalid or duplicate request'):
        c.assess('request-1',json.dumps(manifest))
    assert direct_vm.run_validator() is True
    direct_vm.clear_mocks()
    conflicting_report = dict(report, outcome='Human inspection required')
    direct_vm.mock_llm(r'(?s).*', json.dumps(conflicting_report))
    assert direct_vm.run_validator() is False
    assert json.loads(c.get_assessment('request-1')) == report
    with direct_vm.prank(direct_bob):
        with direct_vm.expect_revert('Unauthorized'):
            c.assess('request-2','{}')
    with direct_vm.expect_revert('Invalid criteria'):
        c.assess('request-3',json.dumps({'criteria':[]}))
    bad_manifest = dict(manifest,evidence=[{'id':'e1','hash':'invalid'}])
    with direct_vm.expect_revert('Invalid content hash'):
        c.assess('request-4',json.dumps(bad_manifest))
    direct_vm.clear_mocks()
    invalid_report = dict(report,outcome='Requirements satisfied')
    direct_vm.mock_llm(r'(?s).*',json.dumps(invalid_report))
    with direct_vm.expect_revert('Uncertainty must be escalated'):
        c.assess('request-5',json.dumps(manifest))
