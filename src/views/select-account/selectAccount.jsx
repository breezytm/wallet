import { Button, DataView } from "@pokt-foundation/ui";
import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import IconWithLabel from "../../components/iconWithLabel/iconWithLabel";
import Layout from "../../components/layout";
import TroubleConnectingModal from "../../components/modals/troubleConnecting/troubleConnecting";
import SelectAccountContent from "../../components/select-account/content";
import { useLoader } from "../../context/loaderContext";
import { useUser } from "../../context/userContext";
import { getDataSource } from "../../datasource";
import useTransport from "../../hooks/useTransport";
import useWindowSize from "../../hooks/useWindowSize";
import { LEDGER_CONFIG } from "../../utils/hardwareWallet";
import { ROUTES } from "../../utils/routes";
import { getAddressFromPublicKey } from "../../utils/utils";

const dataSource = getDataSource();
const ITEMS_PER_PAGE = 5;

// Gets the next ITEMS_PER_PAGE accounts
async function getAccounts(idx, pocketApp) {
  if (!pocketApp) return [];

  const tempAccounts = [];
  for (let i = idx; i < idx + ITEMS_PER_PAGE; i++) {
    let publicKey;
    try {
      const { publicKey: ledgerPublicKey } = await pocketApp.getPublicKey(
        LEDGER_CONFIG.generateDerivationPath(i)
      );
      publicKey = Buffer.from(ledgerPublicKey, "hex").toString("hex");
    } catch (error) {
      console.error(`${error}`);
      throw error;
    }
    const address = await getAddressFromPublicKey(publicKey);
    const balance = await dataSource.getBalance(address);
    tempAccounts.push({
      index: i,
      address,
      balance: balance.toLocaleString("en-US"),
      publicKey,
    });
  }

  return tempAccounts;
}

export default function SelectAccount() {
  let history = useHistory();
  const { pocketApp } = useTransport();
  const { updateUser } = useUser();
  const { updateLoader } = useLoader();
  const { width } = useWindowSize();
  // List of all accounts
  const [accounts, setAccounts] = useState([]);
  // Manages pagination
  const [selectedIndx, setSelectedIdx] = useState(0);
  // Manages which account is selected from the table/accounts array
  const [accountIdx, setAccountIdx] = useState(null);
  const [error, setError] = useState("");
  const [troubleConnectingOpen, setTroubleConnectingOpen] = useState(false);
  // 1 based. This makes it easier to correctly get the firstIdx,
  // also since slice doesn't include the end
  // this makes sure the data we are getting from the array is correct.
  const lastIdxPos = (selectedIndx + 1) * ITEMS_PER_PAGE;
  // 0 based
  const firstIdxPos = Math.abs(lastIdxPos - ITEMS_PER_PAGE);
  const accountsToRender = accounts.slice(firstIdxPos, lastIdxPos);

  const fillAccounts = useCallback(async () => {
    updateLoader(true);
    const i = accounts.length > 0 ? accounts[accounts.length - 1].index + 1 : 0;
    let newAccounts;
    try {
      newAccounts = await getAccounts(i, pocketApp);
    } catch (error) {
      console.error(`${error}`);
      setError(error);
      return;
    }
    setAccounts((prevAccounts) => [...prevAccounts, ...newAccounts]);
    updateLoader(false);
    setAccountIdx(null);
  }, [accounts, pocketApp, updateLoader]);

  const prev = () => {
    if (selectedIndx === 0) return;
    setSelectedIdx((prevSelectedIdx) => prevSelectedIdx - 1);
  };

  const next = async () => {
    const nextLastIdxPos = (selectedIndx + 2) * ITEMS_PER_PAGE;
    if (nextLastIdxPos <= accounts.length) {
      setSelectedIdx((prevSelectedIdx) => prevSelectedIdx + 1);
      return;
    }

    await fillAccounts();
    setSelectedIdx((prevSelectedIdx) => prevSelectedIdx + 1);
  };

  const unlockAccount = () => {
    const account = accounts[accountIdx];
    updateUser(account.address, account.publicKey, "");
    LEDGER_CONFIG.updateDerivationPath(accountIdx);
    history.push({
      pathname: ROUTES.account,
      data: true,
    });
  };

  useEffect(() => {
    getAccounts(0, pocketApp)
      .then((account) => setAccounts(account))
      .catch((error) => {
        setError(`${error}`);
        updateLoader(false);
        setTroubleConnectingOpen(true);
      });
  }, [pocketApp, updateLoader]);

  useEffect(() => {
    if (accounts.length === 0) updateLoader(true);
    else updateLoader(false);

    return () => updateLoader(false);
  }, [accounts.length, updateLoader]);

  if (!pocketApp) {
    history.push({
      pathname: ROUTES.import,
      data: false,
    });
  }

  return (
    <Layout title={<h1 className="title">Select an Account</h1>}>
      <SelectAccountContent>
        <DataView
          mode={width > 768 ? "table" : "list"}
          fields={[
            {
              label: <></>,
            },
            {
              label: <div className="header">Index</div>,
            },
            {
              label: <div className="header">Address</div>,
            },
            {
              label: <div className="header">Balance</div>,
            },
          ]}
          entries={accountsToRender}
          renderEntry={({ index, address, balance }) => [
            <input
              className="account"
              type="radio"
              name="account"
              onChange={() => setAccountIdx(index)}
              checked={index === accountIdx}
            />,
            <p>{index}</p>,
            <p>{address}</p>,
            <p>{balance}</p>,
          ]}
        />

        <IconWithLabel message={error} show={error} type="error" />

        <div className="pagination">
          <Button
            className="prev"
            onClick={() => prev()}
            disabled={accountsToRender < 1 || selectedIndx === 0}
          >
            &lt; Prev
          </Button>
          <Button
            className="next"
            disabled={accountsToRender.length < 1}
            onClick={() => next()}
          >
            Next &gt;
          </Button>
        </div>

        <Button
          className="unlock"
          mode="primary"
          onClick={() => unlockAccount()}
          disabled={accountIdx === null}
        >
          Unlock
        </Button>
      </SelectAccountContent>
      <TroubleConnectingModal
        open={troubleConnectingOpen}
        onClose={() => setTroubleConnectingOpen(false)}
      />
    </Layout>
  );
}
