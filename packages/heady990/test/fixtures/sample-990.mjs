// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady990 — test fixture: a realistic IRS MeF 990 return   ║
// ║  Real MeF element names (ReturnHeader/Filer/IRS990) with a handful ║
// ║  of representative financial + governance fields. © 2026 Heady    ║
// ╚══════════════════════════════════════════════════════════════════╝

export const SAMPLE_990_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Return xmlns="http://www.irs.gov/efile" returnVersion="2023v5.0">
  <ReturnHeader binaryAttachmentCnt="0">
    <TaxPeriodEndDt>2023-12-31</TaxPeriodEndDt>
    <ReturnTypeCd>990</ReturnTypeCd>
    <Filer>
      <EIN>123456789</EIN>
      <BusinessName>
        <BusinessNameLine1Txt>ACME COMMUNITY FOUNDATION</BusinessNameLine1Txt>
      </BusinessName>
      <USAddress>
        <StateAbbreviationCd>CA</StateAbbreviationCd>
      </USAddress>
    </Filer>
  </ReturnHeader>
  <ReturnData documentCnt="1">
    <IRS990 documentId="RetDoc1">
      <CYTotalRevenueAmt>2450000</CYTotalRevenueAmt>
      <CYTotalExpensesAmt>2100000</CYTotalExpensesAmt>
      <TotalAssetsEOYAmt>5300000</TotalAssetsEOYAmt>
      <TotalLiabilitiesEOYAmt>800000</TotalLiabilitiesEOYAmt>
      <NetAssetsOrFundBalancesEOYAmt>4500000</NetAssetsOrFundBalancesEOYAmt>
      <VotingMembersGoverningBodyCnt>11</VotingMembersGoverningBodyCnt>
      <VotingMembersIndependentCnt>9</VotingMembersIndependentCnt>
    </IRS990>
  </ReturnData>
</Return>`;
