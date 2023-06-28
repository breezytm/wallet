import { Banner, Button, Modal } from "@pokt-foundation/ui";
import { typeGuard } from "@pokt-network/pocket-js";
import React, { useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import IconWithLabel from "../../components/iconWithLabel/iconWithLabel";
import PasswordInput from "../../components/input/passwordInput";
import { StakingModalContent } from "../../components/staking/content";
import { Config } from "../../config/config";
import { useTx } from "../../context/txContext";
import { useUser } from "../../context/userContext";
import { getDataSource } from "../../datasource";
import useTransport from "../../hooks/useTransport";
import { isAddress } from "../../utils/isAddress";
import { ROUTES } from "../../utils/routes";
import { getAddressFromPublicKey, UPOKT } from "../../utils/utils";
import { STDX_MSG_TYPES } from "../../utils/validations";

const dataSource = getDataSource();

export default function StakingModal({
  isOpen,
  setIsOpen,
  stakeData,
  selectedChains,
}) {
  console.log("STAKE DATA: ", stakeData);
  console.log("SELECTED CHAINS (MODAL): ", selectedChains);
  let history = useHistory();
  const {
    user: { ppk },
  } = useUser();
  const { updateTx } = useTx();
  const {
    isUsingHardwareWallet,
    isHardwareWalletLoading,
    stakeNode,
    setIsHardwareWalletLoading,
  } = useTransport();
  const sendRef = useRef(null);
  const [error, setError] = useState("");

  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    if (sendRef.current) {
      sendRef.current.disabled = true;
    }
    console.log("staking modal submit");
    const formData = new FormData(e.target);
    const { passphrase } = Object.fromEntries(formData);
    const { serviceURI, amount, operatorPublicKey, outputAddress } =
      stakeData.current;
    console.log("STAKING MODAL FORM DATA: ", formData);

    const url = new URL(serviceURI);
    console.log("URL: ", url);

    if (!isAddress(outputAddress)) {
      setError("Invalid Output Address");
      if (sendRef.current) sendRef.current.disabled = false;
      return;
    }

    console.log("OUTPUT ADDRESS IS GOOD");

    const operatorAddress = await getAddressFromPublicKey(operatorPublicKey);

    if (!isAddress(operatorAddress)) {
      setError("Invalid Operator Public Key");
      if (sendRef.current) sendRef.current.disabled = false;
      return;
    }

    console.log("OPERATOR ADDRESS IS GOOD");

    if (selectedChains.length === 0) {
      setError("At least one chain must be selected");
      if (sendRef.current) sendRef.current.disabled = false;
      return;
    }

    console.log("SELECTED CHAINS IS GOOD");

    if (isUsingHardwareWallet) {
      console.log("IS USING HARDWARE WALLET");
      const ledgerTxResponse = await stakeNode(
        selectedChains,
        operatorPublicKey,
        url,
        (Number(amount) * UPOKT).toString(),
        outputAddress
      );

      if (typeGuard(ledgerTxResponse, Error)) {
        console.log("LEDGER TX RES ERROR: ", ledgerTxResponse);
        setError(
          ledgerTxResponse?.message
            ? ledgerTxResponse.message
            : "Failed to send the transaction, please verify the information."
        );
        if (sendRef.current) sendRef.current.disabled = false;
        return;
      }

      updateTx(
        STDX_MSG_TYPES.stake8,
        "",
        "",
        amount,
        ledgerTxResponse.txhash,
        Number(Config.TX_FEE) / UPOKT,
        "Pending",
        "Pending",
        undefined,
        "Stake Node - Pocket Wallet",
        operatorPublicKey,
        outputAddress
      );

      history.push({
        pathname: "/transaction-detail",
        data: { txHash: ledgerTxResponse.txhash, comesFromSend: true },
        loadFromCache: true,
      });
      return;
    }

    const request = await dataSource.stakeNode(
      ppk,
      passphrase,
      operatorPublicKey,
      outputAddress,
      selectedChains,
      (Number(amount) * UPOKT).toString(),
      url
    );

    if (typeGuard(request, Error)) {
      setError(`${request}`);
      console.error(request);
      if (sendRef.current) sendRef.current.disabled = false;
      return;
    }

    setError("");
    const { txhash } = request;
    updateTx(
      "Node Stake",
      outputAddress,
      operatorPublicKey,
      amount,
      txhash,
      Number(Config.TX_FEE) / UPOKT,
      "Pending",
      "Pending",
      undefined,
      "Stake Node - Pocket wallet",
      operatorPublicKey,
      outputAddress
    );

    history.push({
      pathname: ROUTES.txDetail,
      data: { txhash, comesFromSend: true },
      loadFromCache: true,
    });
    return;
  };

  const onClose = () => {
    setError("");
    setIsOpen(false);
    setIsHardwareWalletLoading(false);
  };

  return (
    <Modal
      visible={isOpen}
      onClose={isHardwareWalletLoading ? () => null : onClose}
      closeButton={!isHardwareWalletLoading}
      className="pocket-modal"
    >
      <StakingModalContent>
        {isUsingHardwareWallet && isHardwareWalletLoading && (
          <div className="ledger-banner-container">
            <Banner title="Action Required" mode="info">
              Please confirm on your ledger device to complete the transaction.
            </Banner>
          </div>
        )}

        <form onSubmit={(e) => handleConfirmSubmit(e)}>
          {!isUsingHardwareWallet && (
            <h1 className="modal-title">
              Confirm your passphrase to complete the transaction
            </h1>
          )}
          <div>
            {!isUsingHardwareWallet && (
              <PasswordInput
                placeholder="Passphrase"
                name="passphrase"
                required
              />
            )}
            <IconWithLabel
              message={error}
              show={error}
              type="error"
              className="error"
            />
          </div>

          <h2 className="you-are-sending">
            You are Staking {stakeData.current?.amount} POKT
          </h2>
          <div className="confirm-container">
            <Button mode="primary" type="submit" ref={sendRef}>
              Confirm Stake Node
            </Button>
          </div>
        </form>
      </StakingModalContent>
    </Modal>
  );
}
