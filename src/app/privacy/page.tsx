export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          개인정보처리방침
        </h1>

        <div className="space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. 개인정보의 처리목적
            </h2>
            <p className="leading-relaxed mb-4">
              호담(HODAM)은 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고
              있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용
              목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의
              동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <div className="space-y-2">
              <p>
                1) 회원 가입 및 관리: 회원 식별, 서비스 이용에 따른 본인확인,
                개인 식별, 불량회원의 부정 이용 방지와 비인가 사용 방지
              </p>
              <p>
                2) 서비스 제공: AI 동화 생성 서비스, 번역 서비스, 이미지 생성
                서비스 제공
              </p>
              <p>3) 고객 지원: 고객 문의 응답, 서비스 개선을 위한 의견 수렴</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. 개인정보의 처리 및 보유기간
            </h2>
            <div className="space-y-2">
              <p>
                1) 회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터
                개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서
                개인정보를 처리·보유합니다.
              </p>
              <p>2) 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다:</p>
              <div className="ml-4 space-y-1">
                <p>- 회원 정보: 회원 탈퇴 시까지</p>
                <p>- 서비스 이용 기록: 3년 (전자상거래법)</p>
                <p>- 결제 정보: 5년 (전자상거래법)</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. 처리하는 개인정보의 항목
            </h2>
            <div className="space-y-2">
              <p>회사는 다음의 개인정보 항목을 처리하고 있습니다:</p>
              <div className="ml-4 space-y-1">
                <p>1) 필수항목: 이메일 주소</p>
                <p>
                  2) 자동 수집 항목: 서비스 이용 기록, 접속 로그, 쿠키, 접속 IP
                  정보
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. 개인정보의 제3자 제공
            </h2>
            <div className="space-y-2">
              <p>
                회사는 정보주체의 개인정보를 개인정보의 처리목적에서 명시한 범위
                내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등
                개인정보보호법 제17조에 해당하는 경우에만 개인정보를 제3자에게
                제공합니다.
              </p>
              <p>현재 회사는 개인정보를 제3자에게 제공하지 않습니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. 개인정보처리의 위탁
            </h2>
            <div className="space-y-2">
              <p>
                회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보
                처리업무를 위탁하고 있습니다:
              </p>
              <div className="ml-4 space-y-2">
                <p>1) 클라우드 서비스 제공업체</p>
                <div className="ml-4">
                  <p>- 위탁받는 자: Supabase Inc.</p>
                  <p>
                    - 위탁하는 업무의 내용: 데이터베이스 관리 및 서버 호스팅
                  </p>
                </div>
                <p>2) AI 서비스 제공업체</p>
                <div className="ml-4">
                  <p>- 위탁받는 자: OpenAI</p>
                  <p>- 위탁하는 업무의 내용: AI 동화 생성 및 번역 서비스</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. 정보주체의 권리·의무 및 행사방법
            </h2>
            <div className="space-y-2">
              <p>
                정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련
                권리를 행사할 수 있습니다:
              </p>
              <div className="ml-4 space-y-1">
                <p>1) 개인정보 처리현황 통지요구</p>
                <p>2) 개인정보 열람요구</p>
                <p>3) 개인정보 정정·삭제요구</p>
                <p>4) 개인정보 처리정지요구</p>
              </div>
              <p className="mt-4">
                위 권리 행사는 개인정보보호법 시행규칙 별지 제8호 서식에 따라
                작성하여 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수
                있으며 회사는 이에 대해 지체없이 조치하겠습니다.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. 개인정보의 안전성 확보조치
            </h2>
            <div className="space-y-2">
              <p>
                회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고
                있습니다:
              </p>
              <div className="ml-4 space-y-1">
                <p>
                  1) 관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육 등
                </p>
                <p>
                  2) 기술적 조치: 개인정보처리시스템 등의 접근권한 관리,
                  접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램
                  설치
                </p>
                <p>3) 물리적 조치: 전산실, 자료보관실 등의 접근통제</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. 개인정보보호책임자
            </h2>
            <div className="space-y-2">
              <p>
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보
                처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와
                같이 개인정보보호책임자를 지정하고 있습니다:
              </p>
              <div className="ml-4 space-y-1">
                <p>개인정보보호책임자</p>
                <p>- 성명: 이윤신</p>
                <p>- 연락처: dldbstls7777@naver.com</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. 개인정보 처리방침 변경
            </h2>
            <p className="leading-relaxed">
              이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른
              변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일
              전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              10. 쿠키의 운영 및 거부
            </h2>
            <div className="space-y-2">
              <p>
                회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를
                저장하고 수시로 불러오는 쿠키(cookie)를 사용합니다.
              </p>
              <p>
                쿠키는 웹사이트를 운영하는데 이용되는 서버(http)가 이용자의
                컴퓨터 브라우저에게 보내는 소량의 정보이며 이용자들의 PC
                컴퓨터내의 하드디스크에 저장되기도 합니다.
              </p>
              <p>
                이용자는 쿠키 설치에 대한 선택권을 가지고 있으며, 웹브라우저에서
                옵션을 설정함으로써 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다
                확인을 거치거나, 아니면 모든 쿠키의 저장을 거부할 수도 있습니다.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            본 개인정보처리방침은 2024년 1월 1일부터 시행됩니다.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            개인정보 관련 문의사항이 있으시면{" "}
            <a
              href="mailto:dldbstls7777@naver.com"
              className="text-orange-600 hover:text-orange-700"
            >
              dldbstls7777@naver.com
            </a>
            으로 연락주시기 바랍니다.
          </p>
        </div>
      </div>
    </div>
  );
}
